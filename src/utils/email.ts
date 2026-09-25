import "server-only";

import nodemailer from "nodemailer";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { prisma } from "@/utils/db";

export type EmailType =
  | "waitlist_joined"
  | "waitlist_invite"
  | "email_verification"
  | "registration_complete"
  | "password_reset"
  | "password_changed"
  | "login_success"
  | "contact_message"
  | "portfolio_inquiry"
  | "contract_review"
  | "contract_signing"
  | "contract_executed"
  | "contract_void"
  | "contract_acceptance_due"
  | "invoice_ready"
  | "invoice_sent"
  | "two_factor_enabled"
  | "two_factor_disabled"
  | "two_factor_recovery_codes_regenerated"
  | "weekly_summary";

export type EmailFailureReason = "not_configured" | "transient_failure" | "permanent_failure";

export type EmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: EmailFailureReason; retryable: boolean; providerCode?: string };

type EmailProvider = "disabled" | "console" | "smtp" | "zoho" | "ses";

const appEnvironment = (process.env.APP_ENV || "").toLowerCase();
// Dev/test instances created before the EMAIL_PROVIDER SSM parameter existed
// should still be able to send verification mail through the EC2 SES role.
const nonProductionEnvironment = ["dev", "test", "development", "staging"].includes(appEnvironment);
const configuredProvider = (process.env.EMAIL_PROVIDER || "").toLowerCase();
const requestedProvider = (
  nonProductionEnvironment && ["", "disabled"].includes(configuredProvider)
    ? "ses"
    : configuredProvider || "smtp"
).toLowerCase();
const emailProvider: EmailProvider = ["disabled", "console", "smtp", "zoho", "ses"].includes(requestedProvider)
  ? requestedProvider as EmailProvider
  : "disabled";
const smtpHost = process.env.SMTP_HOST || "";
const smtpPort = Number.parseInt(process.env.SMTP_PORT || (emailProvider === "zoho" ? "465" : "587"), 10);
const smtpSecure = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === "true"
  : smtpPort === 465;
const smtpConfigured = (emailProvider === "smtp" || emailProvider === "zoho") && Boolean(
  smtpHost && process.env.SMTP_USER && process.env.SMTP_PASS && Number.isSafeInteger(smtpPort),
);
const sesConfigured = emailProvider === "ses" && Boolean(process.env.AWS_REGION);
const ses = sesConfigured ? new SESv2Client({ region: process.env.AWS_REGION }) : null;

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      requireTLS: !smtpSecure,
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        minVersion: "TLSv1.2",
        servername: smtpHost,
      },
    })
  : null;

const appUrl = (process.env.APP_URL || "https://www.rive.work").replace(/\/$/, "");

/**
 * Rive's typeface (Outfit, self-hosted — no third-party font request) with a
 * system fallback chain for clients that ignore @font-face, such as Gmail and
 * Outlook for Windows. Inline font stacks must use single quotes.
 */
const EMAIL_FONT_STACK = "'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const fromAddress = process.env.EMAIL_FROM || `"rive." <${process.env.SMTP_USER || "hello@rive.work"}>`;
const replyTo = process.env.EMAIL_REPLY_TO || "hello@rive.work";

export function getEmailProvider(): EmailProvider {
  return emailProvider;
}

export function getEmailConfigurationStatus() {
  return {
    provider: emailProvider,
    configured: emailProvider === "console" || Boolean(ses || transporter),
    smtpHost: transporter ? smtpHost : undefined,
    smtpPort: transporter ? smtpPort : undefined,
    smtpSecure: transporter ? smtpSecure : undefined,
    fromAddress,
    replyTo,
    missing: emailProvider === "ses"
      ? (!process.env.AWS_REGION ? ["AWS_REGION"] : [])
      : emailProvider === "smtp" || emailProvider === "zoho"
        ? [
            ...(!smtpHost ? ["SMTP_HOST"] : []),
            ...(!process.env.SMTP_USER ? ["SMTP_USER"] : []),
            ...(!process.env.SMTP_PASS ? ["SMTP_PASS"] : []),
          ]
        : emailProvider === "disabled"
          ? ["EMAIL_PROVIDER"]
        : [],
  };
}

export async function verifyEmailTransport(): Promise<{ ok: boolean; message: string }> {
  if (emailProvider === "console") return { ok: true, message: "Console email delivery is enabled for local development." };
  if (transporter) {
    try {
      await transporter.verify();
      return { ok: true, message: `SMTP connection to ${smtpHost}:${smtpPort} authenticated successfully.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "SMTP verification failed." };
    }
  }
  if (ses) return { ok: true, message: `Amazon SES is configured in ${process.env.AWS_REGION}.` };
  const status = getEmailConfigurationStatus();
  return {
    ok: false,
    message: status.provider === "disabled"
      ? "Email delivery is disabled."
      : `Email delivery is missing: ${status.missing.join(", ")}.`,
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] || character,
  );
}

function baseTemplate({
  eyebrow,
  title,
  intro,
  body,
  action,
  actionUrl,
  aside,
  recipient,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  body: string;
  action?: string;
  actionUrl?: string;
  aside?: string;
  recipient: string;
}): string {
  const safeRecipient = escapeHtml(recipient);
  const button =
    action && actionUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 28px"><tr><td style="background:#181511">
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:14px 24px;color:#F7F5ED;font-size:15px;line-height:20px;font-weight:700;text-decoration:none">${escapeHtml(action)} &rarr;</a>
        </td></tr></table>
        <p style="margin:0 0 24px;color:#6F6757;font-size:12px;line-height:18px;word-break:break-all">If the button does not work, paste this link into your browser:<br><a href="${escapeHtml(actionUrl)}" style="color:#1D4ED8;text-decoration:underline">${escapeHtml(actionUrl)}</a></p>`
      : "";

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title><style>@font-face{font-family:"Outfit";src:url("${appUrl}/fonts/outfit-marketing.woff2") format("woff2");font-weight:100 900;font-style:normal}</style></head>
<body style="margin:0;background:#F7F5ED;color:#181511;font-family:${EMAIL_FONT_STACK};-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(intro)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5ED">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
        <tr><td style="padding:0 4px 24px;font-size:28px;font-weight:800;letter-spacing:-1px;color:#181511">rive<span style="color:#1D4ED8">.</span></td></tr>
        <tr><td style="border:2px solid #181511;background:#FDFCF7">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="height:4px;background:#1D4ED8;font-size:0;line-height:0">&nbsp;</td></tr>
            <tr><td style="padding:38px 38px 34px">
              <p style="margin:0 0 12px;color:#1D4ED8;font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase">${escapeHtml(eyebrow)}</p>
              <h1 style="margin:0 0 18px;color:#181511;font-size:32px;line-height:38px;letter-spacing:-1px">${escapeHtml(title)}</h1>
              <p style="margin:0 0 20px;color:#55503F;font-size:16px;line-height:26px">${escapeHtml(intro)}</p>
              ${body}
              ${button}
              ${aside ? `<div style="margin-top:26px;padding:16px 20px;border:1px solid #DDD6C7;background:#F1EDE2;color:#55503F;font-size:13px;line-height:21px">${aside}</div>` : ""}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 8px 0;color:#6F6757;font-size:12px;line-height:19px">
          <p style="margin:0 0 6px">Questions? Reply to this email or write to <a href="mailto:hello@rive.work" style="color:#1D4ED8;text-decoration:none">hello@rive.work</a>.</p>
          <p style="margin:0">&copy; ${new Date().getFullYear()} rive. &middot; Bengaluru, India<br>This message was sent to ${safeRecipient}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function sanitizeEmailDiagnostic(value: string): string {
  return value
    .replace(/\b[a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S+/g, (url) =>
      /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]*@/.test(url) ? "[redacted-url]" : url)
    .replace(/\S*@\S*/g, "[redacted-email]")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function classifyEmailProviderError(error: unknown): {
  reason: "transient_failure" | "permanent_failure";
  retryable: boolean;
  providerCode?: string;
  diagnostic: string;
} {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const responseCode = typeof record.responseCode === "number" ? record.responseCode : null;
  const code = typeof record.code === "string" ? record.code : "";
  const name = typeof record.name === "string" ? record.name : "";

  const permanentProviderCode = [code, name].some(
    (candidate) => /^(MessageRejected|InvalidParameterValue|InvalidParameter)(Exception)?$/.test(candidate),
  );
  const permanent = permanentProviderCode || (responseCode !== null && responseCode >= 500 && responseCode <= 599);
  const rawCode = responseCode !== null ? String(responseCode) : code || name;
  const providerCode = rawCode ? rawCode.slice(0, 80) : undefined;
  const message = error instanceof Error ? error.message : String(error || "Unknown delivery error");

  return {
    reason: permanent ? "permanent_failure" : "transient_failure",
    retryable: !permanent,
    ...(providerCode ? { providerCode } : {}),
    diagnostic: sanitizeEmailDiagnostic(message),
  };
}

export const __emailTestInternals = {
  classifyEmailProviderError,
  sanitizeEmailDiagnostic,
} as const;

async function deliver({
  to,
  type,
  subject,
  html,
  text,
  replyToAddress,
}: {
  to: string;
  type: EmailType;
  subject: string;
  html: string;
  text: string;
  replyToAddress?: string;
}): Promise<EmailResult> {
  if (emailProvider === "console") {
    const messageId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.info(`\n[email:console] ${type} -> ${to}\nSubject: ${subject}\n\n${text}\n`);
    await prisma.emailDelivery
      .create({
        data: { recipient: to, type, status: "local", providerMessageId: messageId },
      })
      .catch((error) => console.error("email: failed to record local delivery", error));
    return { sent: true, messageId };
  }

  if (!ses && !transporter) {
    console.warn(`email: ${type} skipped because an email provider is not configured`);
    await prisma.emailDelivery
      .create({
        data: {
          recipient: to,
          type,
          status: "skipped",
          error: "Email provider is not configured",
        },
      })
      .catch((error) => console.error("email: failed to record skipped delivery", error));
    return { sent: false, reason: "not_configured", retryable: true };
  }

  try {
    const messageId = ses
      ? (
          await ses.send(
            new SendEmailCommand({
              FromEmailAddress: fromAddress,
              ReplyToAddresses: [replyToAddress || replyTo],
              Destination: { ToAddresses: [to] },
              Content: {
                Simple: {
                  Subject: { Data: subject, Charset: "UTF-8" },
                  Body: {
                    Html: { Data: html, Charset: "UTF-8" },
                    Text: { Data: text, Charset: "UTF-8" },
                  },
                },
              },
              ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
            }),
          )
        ).MessageId
      : (
          await transporter!.sendMail({
            from: fromAddress,
            replyTo: replyToAddress || replyTo,
            to,
            subject,
            html,
            text,
          })
        ).messageId;
    if (typeof messageId !== "string" || !messageId.trim()) {
      throw new Error("Email provider returned no message identifier.");
    }
    await prisma.emailDelivery
      .create({
        data: {
          recipient: to,
          type,
          status: "sent",
          providerMessageId: messageId,
        },
      })
      .catch((error) => console.error("email: failed to record successful delivery", error));
    return { sent: true, messageId };
  } catch (error) {
    const classified = classifyEmailProviderError(error);
    console.error(`email: ${type} delivery failed (${classified.reason}${classified.providerCode ? ` ${classified.providerCode}` : ""})`, error);
    await prisma.emailDelivery
      .create({
        data: { recipient: to, type, status: "failed", error: classified.diagnostic },
      })
      .catch((logError) => console.error("email: failed to record delivery error", logError));
    return {
      sent: false,
      reason: classified.reason,
      retryable: classified.retryable,
      ...(classified.providerCode ? { providerCode: classified.providerCode } : {}),
    };
  }
}

export function sendWaitlistJoinedEmail(to: string, type: string): Promise<EmailResult> {
  const remit = type === "remit";
  const title = remit ? "You’re on the Remit early-access list." : "Your place is saved.";
  const intro = remit
    ? "Thanks for raising your hand for Remit. We’ll write when early access is ready for you."
    : "Thanks for joining Rive. We’ll review early-access requests in small batches.";
  const body = remit
    ? `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">Remit is being designed to make cross-border payments less painful for independent professionals. We are still building it, so we will only email you when there is a meaningful product update or an invitation to try it.</p>`
    : `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">Rive brings the operational side of independent work together: clients, projects, invoices, expenses, and a public portfolio. If your access is approved, you’ll receive a secure, personal registration link from us.</p>`;

  return deliver({
    to,
    type: "waitlist_joined",
    subject: remit ? "Your Remit early-access spot is saved" : "You’re on the Rive early-access list",
    html: baseTemplate({
      eyebrow: "early access",
      title,
      intro,
      body,
      action: "Explore Rive",
      actionUrl: appUrl,
      aside: "You do not need to do anything else. We will never ask for your password over email.",
      recipient: to,
    }),
    text: `${title}\n\n${intro}\n\nExplore Rive: ${appUrl}\n\nQuestions? hello@rive.work`,
  });
}

export function sendWaitlistInviteEmail(to: string, token: string): Promise<EmailResult> {
  const inviteUrl = `${appUrl}/register?invite=${encodeURIComponent(token)}`;
  return deliver({
    to,
    type: "waitlist_invite",
    subject: "Your rive. workspace is ready",
    html: baseTemplate({
      eyebrow: "you’re invited",
      title: "Your workspace is ready.",
      intro: "We’d love to welcome you into rive. early access.",
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">Create your account with the secure link below. Your workspace will open immediately, with everything ready for you to start organising clients, work, finances, and your portfolio.</p>`,
      action: "Create my workspace",
      actionUrl: inviteUrl,
      aside: "<strong style=\"color:#181511\">This invitation is personal.</strong> It expires in 7 days and can be used once. If it expires, reply to this email and we’ll help.",
      recipient: to,
    }),
    text: `Your rive. workspace is ready.\n\nCreate your account using this personal link (valid for 7 days):\n${inviteUrl}\n\nQuestions? hello@rive.work`,
  });
}

export function sendRegistrationCompleteEmail(to: string, name: string): Promise<EmailResult> {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  return deliver({
    to,
    type: "registration_complete",
    subject: "Welcome to rive. — your workspace is live",
    html: baseTemplate({
      eyebrow: "welcome to rive.",
      title: `Good to have you here, ${firstName}.`,
      intro: "Your workspace is live. Start with the part of your business that feels the messiest today.",
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 0">
        <tr><td style="padding:9px 0;color:#55503F;font-size:15px"><strong style="color:#181511">01</strong>&nbsp;&nbsp;Add a client and the work you’re doing together.</td></tr>
        <tr><td style="padding:9px 0;color:#55503F;font-size:15px"><strong style="color:#181511">02</strong>&nbsp;&nbsp;Track an invoice or expense to see your numbers clearly.</td></tr>
        <tr><td style="padding:9px 0;color:#55503F;font-size:15px"><strong style="color:#181511">03</strong>&nbsp;&nbsp;Shape and publish your portfolio when you’re ready.</td></tr>
      </table>`,
      action: "Open my dashboard",
      actionUrl: `${appUrl}/dashboard`,
      aside: "A practical start beats a perfect setup. Add one real client or project first; you can refine everything later.",
      recipient: to,
    }),
    text: `Welcome to rive., ${name}.\n\nYour workspace is live: ${appUrl}/dashboard\n\nStart by adding one real client or project. Questions? hello@rive.work`,
  });
}

export function buildPasswordResetEmail(to: string, token: string): PreparedEmail {
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to,
    type: "password_reset",
    subject: "Reset your rive. password",
    html: baseTemplate({
      eyebrow: "password reset",
      title: "Let’s get you back in.",
      intro: "We received a request to reset the password for your rive. account.",
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">Use the secure button below to choose a new password. For your protection, the link expires in 60 minutes and works only once.</p>`,
      action: "Choose a new password",
      actionUrl: resetUrl,
      aside: "Didn’t request this? You can safely ignore this email. Your current password will continue to work.",
      recipient: to,
    }),
    text: `Reset your rive. password.\n\nThis secure link expires in 60 minutes:\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
  };
}

export function sendPasswordResetEmail(to: string, token: string): Promise<EmailResult> {
  return deliver(buildPasswordResetEmail(to, token));
}

export function buildPasswordChangedEmail(to: string): PreparedEmail {
  return {
    to,
    type: "password_changed",
    subject: "Your rive. password was changed",
    html: baseTemplate({
      eyebrow: "security notice",
      title: "Your password was changed.",
      intro: "The password for your rive. account has just been updated.",
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">If you made this change, there’s nothing else to do. You can sign in with your new password immediately.</p>`,
      action: "Sign in to rive.",
      actionUrl: `${appUrl}/login`,
      aside: "If this wasn’t you, contact hello@rive.work immediately so we can help secure your account.",
      recipient: to,
    }),
    text: `Your rive. password was changed.\n\nIf this was you, no action is needed. If not, contact hello@rive.work immediately.`,
  };
}

export function sendPasswordChangedEmail(to: string): Promise<EmailResult> {
  return deliver(buildPasswordChangedEmail(to));
}

export function buildLoginSuccessEmail(to: string): PreparedEmail {
  const signedInAt = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return {
    to,
    type: "login_success",
    subject: "New sign-in to your rive. account",
    html: baseTemplate({
      eyebrow: "security notice",
      title: "A new sign-in was completed.",
      intro: `Your rive. account was signed in to on ${signedInAt} IST.`,
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">If this was you, no action is needed. We send this note so unusual access never goes unnoticed.</p>`,
      action: "Open my dashboard",
      actionUrl: `${appUrl}/dashboard`,
      aside: "Don’t recognise this sign-in? Reset your password immediately, then contact hello@rive.work so we can help review the account.",
      recipient: to,
    }),
    text: `New sign-in to your rive. account on ${signedInAt} IST.\n\nIf this was you, no action is needed. If not, reset your password immediately: ${appUrl}/forgot-password`,
  };
}

export function sendLoginSuccessEmail(to: string): Promise<EmailResult> {
  return deliver(buildLoginSuccessEmail(to));
}

export function buildTwoFactorEnabledEmail(to: string): PreparedEmail {
  return {
    to,
    type: "two_factor_enabled",
    subject: "Two-factor authentication is on for your rive. account",
    html: baseTemplate({
      eyebrow: "security notice",
      title: "Two-factor authentication is on.",
      intro: "Your rive. account now requires an authenticator code to sign in, in addition to your password.",
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">We also issued 10 recovery codes. Keep them somewhere safe — each one signs you in exactly once if you lose access to your authenticator app.</p>`,
      aside: "If you didn’t turn this on, contact hello@rive.work immediately so we can help secure your account.",
      recipient: to,
    }),
    text: `Two-factor authentication is now on for your rive. account.\n\nIf this wasn't you, contact hello@rive.work immediately.`,
  };
}

export function sendTwoFactorEnabledEmail(to: string): Promise<EmailResult> {
  return deliver(buildTwoFactorEnabledEmail(to));
}

export function buildTwoFactorDisabledEmail(to: string): PreparedEmail {
  return {
    to,
    type: "two_factor_disabled",
    subject: "Two-factor authentication was turned off",
    html: baseTemplate({
      eyebrow: "security notice",
      title: "Two-factor authentication is off.",
      intro: "Your rive. account no longer requires an authenticator code to sign in.",
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">Your password alone now signs you in. You can turn two-factor authentication back on from Settings at any time.</p>`,
      aside: "If you didn’t make this change, contact hello@rive.work immediately so we can help secure your account.",
      recipient: to,
    }),
    text: `Two-factor authentication was turned off for your rive. account.\n\nIf this wasn't you, contact hello@rive.work immediately.`,
  };
}

export function sendTwoFactorDisabledEmail(to: string): Promise<EmailResult> {
  return deliver(buildTwoFactorDisabledEmail(to));
}

export function buildTwoFactorRecoveryCodesRegeneratedEmail(to: string): PreparedEmail {
  return {
    to,
    type: "two_factor_recovery_codes_regenerated",
    subject: "Your rive. recovery codes were regenerated",
    html: baseTemplate({
      eyebrow: "security notice",
      title: "New recovery codes were issued.",
      intro: "Your old two-factor recovery codes were just replaced with a fresh set of 10.",
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">The old codes no longer work. Save the new codes somewhere safe — each signs you in exactly once if you lose access to your authenticator app.</p>`,
      aside: "If you didn’t request this, contact hello@rive.work immediately so we can help secure your account.",
      recipient: to,
    }),
    text: `Your rive. two-factor recovery codes were regenerated. The old codes no longer work.\n\nIf this wasn't you, contact hello@rive.work immediately.`,
  };
}

export function sendTwoFactorRecoveryCodesRegeneratedEmail(to: string): Promise<EmailResult> {
  return deliver(buildTwoFactorRecoveryCodesRegeneratedEmail(to));
}

export function buildContactMessageEmail(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): PreparedEmail {
  const safeName = escapeHtml(input.name);
  const safeEmail = escapeHtml(input.email);
  const safeSubject = escapeHtml(input.subject);
  const safeMessage = escapeHtml(input.message).replace(/\n/g, "<br>");

  return {
    to: "hello@rive.work",
    type: "contact_message",
    subject: `[rive. contact] ${input.subject}`,
    html: baseTemplate({
      eyebrow: "website enquiry",
      title: input.subject,
      intro: `${input.name} sent a message through rive.work.`,
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;color:#55503F;font-size:14px"><strong style="color:#181511">From:</strong> ${safeName} &lt;${safeEmail}&gt;</td></tr>
        <tr><td style="padding:8px 0;color:#55503F;font-size:14px"><strong style="color:#181511">Subject:</strong> ${safeSubject}</td></tr>
        <tr><td style="padding:18px 0 0;color:#55503F;font-size:15px;line-height:25px">${safeMessage}</td></tr>
      </table>`,
      action: "Reply to sender",
      actionUrl: `mailto:${encodeURIComponent(input.email)}`,
      recipient: "hello@rive.work",
    }),
    text: `${input.subject}\n\nFrom: ${input.name} <${input.email}>\n\n${input.message}`,
    replyToAddress: input.email,
  };
}

/**
 * Built rather than sent, because the enquiry record is committed first and the
 * notification is queued in the same transaction. The portfolio owner keeps the
 * lead even when the mail provider is unavailable.
 */
export function buildPortfolioInquiryEmail(input: {
  to: string;
  portfolioName: string;
  visitorName: string;
  visitorEmail: string;
  projectType: string;
  message: string;
  /** Case study the visitor was reading, when the form knew about one. */
  sourceProjectTitle?: string | null;
}): PreparedEmail {
  const safeVisitorName = escapeHtml(input.visitorName);
  const safeVisitorEmail = escapeHtml(input.visitorEmail);
  const safeProjectType = escapeHtml(input.projectType);
  const safeMessage = escapeHtml(input.message).replace(/\n/g, "<br>");
  const sourceTitle = input.sourceProjectTitle?.trim();
  const sourceRow = sourceTitle
    ? `<tr><td style="padding:8px 0;color:#55503F;font-size:14px"><strong style="color:#181511">Reading:</strong> ${escapeHtml(sourceTitle)}</td></tr>`
    : "";

  return {
    to: input.to,
    type: "portfolio_inquiry",
    subject: `[Portfolio enquiry] ${input.projectType} — ${input.visitorName}`,
    replyToAddress: input.visitorEmail,
    html: baseTemplate({
      eyebrow: "new portfolio enquiry",
      title: `${input.visitorName} would like to work with you.`,
      intro: `A prospective client sent an enquiry through ${input.portfolioName}'s Rive portfolio.`,
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;color:#55503F;font-size:14px"><strong style="color:#181511">From:</strong> ${safeVisitorName} &lt;${safeVisitorEmail}&gt;</td></tr>
        <tr><td style="padding:8px 0;color:#55503F;font-size:14px"><strong style="color:#181511">Project:</strong> ${safeProjectType}</td></tr>
        ${sourceRow}
        <tr><td style="padding:18px 0 0;color:#55503F;font-size:15px;line-height:25px">${safeMessage}</td></tr>
      </table>`,
      action: "Reply to enquiry",
      actionUrl: `mailto:${encodeURIComponent(input.visitorEmail)}`,
      aside: "This enquiry came from your public Rive portfolio, and is saved in your Portfolio Studio inbox. Replying to this email will respond directly to the prospective client.",
      recipient: input.to,
    }),
    text: `New portfolio enquiry\n\nFrom: ${input.visitorName} <${input.visitorEmail}>\nProject: ${input.projectType}${sourceTitle ? `\nReading: ${sourceTitle}` : ""}\n\n${input.message}`,
  };
}

export function buildContractReviewEmail(input: {
  to: string;
  clientName: string;
  ownerName: string;
  contractTitle: string;
  reviewUrl: string;
  expiresAt: Date;
}): PreparedEmail {
  const safeOwner = escapeHtml(input.ownerName);
  const safeTitle = escapeHtml(input.contractTitle);
  const expiry = input.expiresAt.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
  return {
    to: input.to,
    type: "contract_review",
    subject: `${input.ownerName} shared an Agreement for review`,
    html: baseTemplate({
      eyebrow: "Agreement review",
      title: `${safeOwner} shared a draft Agreement with you.`,
      intro: `Please review “${safeTitle}” and leave comments or suggested edits before anyone records acceptance.`,
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">This is a review link, not an acceptance request. The Agreement will not be marked accepted until the parties review the final version and complete the separate recorded-acceptance step.</p>`,
      action: "Review Agreement",
      actionUrl: input.reviewUrl,
      aside: `This link expires on ${expiry} (IST). If you were not expecting this message, do not record acceptance; contact ${safeOwner} through a trusted channel.`,
      recipient: input.to,
    }),
    text: `${input.ownerName} shared “${input.contractTitle}” for review.\n\nReview it here: ${input.reviewUrl}\n\nThis link expires on ${expiry} IST. This is not an acceptance request.`,
  };
}

export function sendContractReviewEmail(input: {
  to: string;
  clientName: string;
  ownerName: string;
  contractTitle: string;
  reviewUrl: string;
  expiresAt: Date;
}): Promise<EmailResult> {
  return deliver(buildContractReviewEmail(input));
}

export function buildContractSigningEmail(input: {
  to: string;
  signerName: string;
  contractTitle: string;
  signUrl: string;
  expiresAt: Date;
}): PreparedEmail {
  const expiry = input.expiresAt.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
  return {
    to: input.to,
    type: "contract_signing",
    subject: `Recorded acceptance requested: ${input.contractTitle}`,
    html: baseTemplate({
      eyebrow: "recorded acceptance requested",
      title: "An Agreement is ready for your review and acceptance.",
      intro: `Please read the complete Agreement before recording acceptance of “${escapeHtml(input.contractTitle)}”.`,
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">The acceptance page will show the exact version, the recorded-acceptance consent language, and the acceptance record created when you type your name and confirm. Only the named client and freelancer parties are invited to accept.</p>`,
      action: "Open acceptance page",
      actionUrl: input.signUrl,
      aside: `This link expires on ${expiry} (IST). Do not forward it. If the name or terms are incorrect, ask the sender to void and reissue the acceptance request.`,
      recipient: input.to,
    }),
    text: `Recorded acceptance requested for “${input.contractTitle}”.\n\nOpen the acceptance page: ${input.signUrl}\n\nThis link expires on ${expiry} IST. Do not forward it.`,
  };
}

export function sendContractSigningEmail(input: {
  to: string;
  signerName: string;
  contractTitle: string;
  signUrl: string;
  expiresAt: Date;
}): Promise<EmailResult> {
  return deliver(buildContractSigningEmail(input));
}

export function buildContractExecutedEmail(input: {
  to: string;
  recipientName: string;
  contractTitle: string;
  artifactUrl: string;
}): PreparedEmail {
  const safeRecipientName = escapeHtml(input.recipientName);
  return {
    to: input.to,
    type: "contract_executed",
    subject: `Agreement accepted: ${input.contractTitle}`,
    html: baseTemplate({
      eyebrow: "Agreement accepted",
      title: "Both parties have recorded acceptance.",
      intro: `The accepted version of “${escapeHtml(input.contractTitle)}” is ready to download and retain.`,
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">Hi ${safeRecipientName}, keep the accepted Agreement and its acceptance record with your business records. The parties should also retain any documents or communications incorporated by reference.</p>`,
      action: "View accepted Agreement",
      actionUrl: input.artifactUrl,
      aside: "This message confirms the record created in Rive; it does not replace any legal, tax, identity, or regulatory requirement that applies to the transaction.",
      recipient: input.to,
    }),
    text: `Both parties recorded acceptance for “${input.contractTitle}”.\n\nView the accepted Agreement: ${input.artifactUrl}`,
  };
}

export function sendContractExecutedEmail(input: {
  to: string;
  recipientName: string;
  contractTitle: string;
  artifactUrl: string;
}): Promise<EmailResult> {
  return deliver(buildContractExecutedEmail(input));
}

export function buildInvoiceReadyEmail(input: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  currency: string;
  dueDate: Date | null;
}): PreparedEmail {
  const due = input.dueDate
    ? input.dueDate.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })
    : "not specified";
  return {
    to: input.to,
    type: "invoice_ready",
    subject: `Invoice ${input.invoiceNumber} is ready to review`,
    html: baseTemplate({
      eyebrow: "invoice ready",
      title: `Invoice ${input.invoiceNumber} is ready.`,
      intro: `A milestone-linked draft invoice for ${input.clientName} has been generated for review.`,
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">Amount: <strong style="color:#181511">${escapeHtml(input.currency)} ${escapeHtml(input.total)}</strong><br>Due date: <strong style="color:#181511">${escapeHtml(due)}</strong></p>`,
      action: "Open revenue workspace",
      actionUrl: `${appUrl}/workflow/revenue`,
      aside: "This email is a prompt to review. No invoice is sent to the client automatically by this notification.",
      recipient: input.to,
    }),
    text: `Invoice ${input.invoiceNumber} is ready to review.\n\nAmount: ${input.currency} ${input.total}\nDue: ${due}\n\nOpen revenue workspace: ${appUrl}/workflow/revenue`,
  };
}

export function sendInvoiceReadyEmail(input: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  currency: string;
  dueDate: Date | null;
}): Promise<EmailResult> {
  return deliver(buildInvoiceReadyEmail(input));
}

export function buildInvoiceSentEmail(input: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  currency: string;
  dueDate: Date | null;
  senderName: string;
  publicUrl?: string;
}): PreparedEmail {
  const due = input.dueDate
    ? input.dueDate.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })
    : "not specified";
  const safeClientName = escapeHtml(input.clientName);
  const safeSenderName = escapeHtml(input.senderName);
  return {
    to: input.to,
    type: "invoice_sent",
    subject: `Invoice ${input.invoiceNumber} from ${input.senderName}`,
    html: baseTemplate({
      eyebrow: "invoice",
      title: `Invoice ${input.invoiceNumber}`,
      intro: `${input.senderName} sent an invoice for your review and payment.`,
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">Hi ${safeClientName}, ${safeSenderName} sent this invoice for your review and payment.<br><br>Amount due: <strong style="color:#181511">${escapeHtml(input.currency)} ${escapeHtml(input.total)}</strong><br>Due date: <strong style="color:#181511">${escapeHtml(due)}</strong></p>`,
      action: input.publicUrl ? "View invoice" : undefined,
      actionUrl: input.publicUrl,
      aside: "The invoice email is a delivery notice. Please verify the sender and payment details using a trusted channel before paying.",
      recipient: input.to,
    }),
    text: `Invoice ${input.invoiceNumber} from ${input.senderName}.\n\nAmount due: ${input.currency} ${input.total}\nDue: ${due}${input.publicUrl ? `\n\nView invoice: ${input.publicUrl}` : ""}\n\nVerify payment details through a trusted channel before paying.`,
  };
}

export function sendInvoiceSentEmail(input: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  currency: string;
  dueDate: Date | null;
  senderName: string;
  publicUrl?: string;
}): Promise<EmailResult> {
  return deliver(buildInvoiceSentEmail(input));
}

/**
 * A void request for an accepted Agreement. The client confirms through a
 * purpose-bound void link; the owner is always sent into their workspace
 * (`actionUrl` is the Agreement page), never handed a public bearer link.
 */
export function buildContractVoidRequestedEmail(input: {
  to: string;
  recipientName: string;
  contractTitle: string;
  requesterName: string;
  note: string;
  actionUrl: string;
  recipientIsOwner: boolean;
}): PreparedEmail {
  const safeRecipient = escapeHtml(input.recipientName);
  const safeRequester = escapeHtml(input.requesterName);
  const safeNote = escapeHtml(input.note).replace(/\n/g, "<br>");
  const how = input.recipientIsOwner
    ? "Open the Agreement in your Rive workspace to confirm or decline the void."
    : "Use the secure link below to confirm or decline the void.";
  return {
    to: input.to,
    type: "contract_void",
    subject: `Void requested: ${input.contractTitle}`,
    html: baseTemplate({
      eyebrow: "void requested",
      title: `${safeRequester} requested to void an accepted Agreement.`,
      intro: `A void request was raised for “${escapeHtml(input.contractTitle)}”. Both parties must agree before it is voided.`,
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">Hi ${safeRecipient}, ${how} The Agreement stays accepted and fully retained until the other party also confirms.</p><p style="margin:18px 0 0;padding:14px 16px;border:1px solid #DDD6C7;border-radius:12px;background:#F1EDE2;color:#55503F;font-size:13px;line-height:21px"><strong style="color:#181511">Reason:</strong><br>${safeNote}</p>`,
      action: input.recipientIsOwner ? "Open the Agreement" : "Review void request",
      actionUrl: input.actionUrl,
      aside: input.recipientIsOwner
        ? "The Agreement is not voided unless you confirm it in Rive."
        : "If you did not expect this message, you can safely ignore it. The Agreement is not voided unless you confirm through the secure link.",
      recipient: input.to,
    }),
    text: `${input.requesterName} requested to void “${input.contractTitle}”.\n\nReason: ${input.note}\n\n${input.recipientIsOwner ? "Open the Agreement" : "Review the void request"}: ${input.actionUrl}\n\nThe Agreement stays accepted until you confirm.`,
  };
}

/** Tells the owner the client has accepted and their own acceptance is next. */
export function buildOwnerAcceptanceDueEmail(input: {
  to: string;
  ownerName: string;
  clientName: string;
  contractTitle: string;
  agreementUrl: string;
}): PreparedEmail {
  const safeClient = escapeHtml(input.clientName);
  return {
    to: input.to,
    type: "contract_acceptance_due",
    subject: `${input.clientName} accepted — your acceptance is next: ${input.contractTitle}`,
    html: baseTemplate({
      eyebrow: "your acceptance is next",
      title: `${safeClient} recorded acceptance.`,
      intro: `“${escapeHtml(input.contractTitle)}” is waiting for your acceptance before it becomes the accepted Agreement.`,
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">Hi ${escapeHtml(input.ownerName)}, open the Agreement in Rive and record your acceptance. Once both parties have accepted, the payment plan starts and the first invoice drafts are prepared for your review.</p>`,
      action: "Open the Agreement",
      actionUrl: input.agreementUrl,
      aside: "You record your acceptance while signed in to Rive. No link in this email records acceptance on its own.",
      recipient: input.to,
    }),
    text: `${input.clientName} recorded acceptance of “${input.contractTitle}”. Your acceptance is next.\n\nOpen the Agreement: ${input.agreementUrl}`,
  };
}

export type WeeklySummaryEmailSection =
  | { kind: "financials"; paidLastWeek: string; outstanding: string; overdue: string; currency: string }
  | { kind: "deadlines"; items: { title: string; dueDate: string }[] }
  | { kind: "meetings"; items: { title: string; startAt: string }[] }
  | { kind: "agreements"; items: { title: string; clientName: string }[] };

/**
 * The opt-in weekly business summary (issue #66, PR 5). Callers pre-format
 * every amount and date — this function only lays the sections out, matching
 * `buildInvoiceReadyEmail`'s split between "the route knows the workspace's
 * currency and time zone" and "the template just renders strings".
 */
export function buildWeeklySummaryEmail(input: {
  to: string;
  name: string;
  weekLabel: string;
  sections: WeeklySummaryEmailSection[];
  unsubscribeUrl: string;
  settingsUrl: string;
}): PreparedEmail {
  const firstName = input.name.trim().split(/\s+/)[0] || "there";
  const rows: string[] = [];
  for (const section of input.sections) {
    if (section.kind === "financials") {
      rows.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px">
        <tr><td style="padding:6px 0;color:#55503F;font-size:15px">Paid last week</td><td align="right" style="padding:6px 0;color:#181511;font-size:15px;font-weight:700">${escapeHtml(section.paidLastWeek)}</td></tr>
        <tr><td style="padding:6px 0;color:#55503F;font-size:15px">Outstanding</td><td align="right" style="padding:6px 0;color:#181511;font-size:15px;font-weight:700">${escapeHtml(section.outstanding)}</td></tr>
        <tr><td style="padding:6px 0;color:#55503F;font-size:15px">Overdue</td><td align="right" style="padding:6px 0;color:#181511;font-size:15px;font-weight:700">${escapeHtml(section.overdue)}</td></tr>
      </table>`);
    } else if (section.kind === "deadlines" && section.items.length) {
      rows.push(`<p style="margin:18px 0 6px;color:#1D4ED8;font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase">Deadlines this week</p>` +
        section.items.map((item) => `<p style="margin:0 0 4px;color:#55503F;font-size:14px">${escapeHtml(item.title)} — <strong style="color:#181511">${escapeHtml(item.dueDate)}</strong></p>`).join(""));
    } else if (section.kind === "meetings" && section.items.length) {
      rows.push(`<p style="margin:18px 0 6px;color:#1D4ED8;font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase">Meetings this week</p>` +
        section.items.map((item) => `<p style="margin:0 0 4px;color:#55503F;font-size:14px">${escapeHtml(item.title)} — <strong style="color:#181511">${escapeHtml(item.startAt)}</strong></p>`).join(""));
    } else if (section.kind === "agreements" && section.items.length) {
      rows.push(`<p style="margin:18px 0 6px;color:#1D4ED8;font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase">Awaiting the client</p>` +
        section.items.map((item) => `<p style="margin:0 0 4px;color:#55503F;font-size:14px">${escapeHtml(item.title)} — <strong style="color:#181511">${escapeHtml(item.clientName)}</strong></p>`).join(""));
    }
  }

  return {
    to: input.to,
    type: "weekly_summary",
    subject: `Your week at rive. — ${input.weekLabel}`,
    html: baseTemplate({
      eyebrow: "weekly summary",
      title: `Here’s your week, ${firstName}.`,
      intro: `A quick look at ${input.weekLabel.toLowerCase()} — money in, money owed, and what’s coming up.`,
      body: rows.join(""),
      action: "Open my dashboard",
      actionUrl: `${appUrl}/dashboard`,
      aside: `You’re getting this because weekly summaries are turned on for your account. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#1D4ED8;text-decoration:underline">Turn off weekly summaries</a> or manage this and other notifications in <a href="${escapeHtml(input.settingsUrl)}" style="color:#1D4ED8;text-decoration:underline">Settings</a>.`,
      recipient: input.to,
    }),
    text: `Your week at rive. — ${input.weekLabel}\n\n${input.sections.map((section) => {
      if (section.kind === "financials") return `Paid last week: ${section.paidLastWeek}\nOutstanding: ${section.outstanding}\nOverdue: ${section.overdue}`;
      if (section.kind === "deadlines") return `Deadlines:\n${section.items.map((i) => `- ${i.title} (${i.dueDate})`).join("\n")}`;
      if (section.kind === "meetings") return `Meetings:\n${section.items.map((i) => `- ${i.title} (${i.startAt})`).join("\n")}`;
      return `Awaiting the client:\n${section.items.map((i) => `- ${i.title} — ${i.clientName}`).join("\n")}`;
    }).join("\n\n")}\n\nOpen your dashboard: ${appUrl}/dashboard\n\nTurn off weekly summaries: ${input.unsubscribeUrl}\nManage notifications: ${input.settingsUrl}`,
  };
}

export type PreparedEmail = {
  to: string;
  type: EmailType;
  subject: string;
  html: string;
  text: string;
  replyToAddress?: string;
  deliveryGuard?:
    | { kind: "contract_signing"; signerId: string; tokenHash: string }
    | { kind: "contract_review"; linkId: string; tokenHash: string }
    | { kind: "contract_void"; linkId: string; tokenHash: string }
    | { kind: "invoice_sent"; invoiceId: string; tokenHash: string };
};

export async function deliverPreparedEmail(email: PreparedEmail): Promise<EmailResult> {
  return deliver(email);
}

export function buildEmailVerificationEmail(to: string, name: string, token: string): PreparedEmail {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const intro = `One quick step, ${firstName}: verify your email so we can keep your Rive workspace secure.`;
  return {
    to,
    type: "email_verification",
    subject: "Verify your Rive email address",
    html: baseTemplate({
      eyebrow: "finish setting up",
      title: "Verify your email address.",
      intro,
      body: `<p style="margin:0;color:#55503F;font-size:15px;line-height:25px">Your account is ready. Verify this email address to open your workspace. The link expires in 24 hours and works only once.</p>`,
      action: "Verify my email",
      actionUrl: verifyUrl,
      aside: "If you did not create a Rive account, you can safely ignore this message.",
      recipient: to,
    }),
    text: `Verify your Rive email address\n\n${intro}\n\nVerify your email: ${verifyUrl}\n\nThis link expires in 24 hours and works once. If you did not create this account, ignore this message.`,
  };
}

export function sendEmailVerificationEmail(to: string, name: string, token: string): Promise<EmailResult> {
  return deliver(buildEmailVerificationEmail(to, name, token));
}
