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
  | "invoice_ready"
  | "invoice_sent";

export type EmailResult = {
  sent: boolean;
  messageId?: string;
  reason?: "not_configured" | "delivery_failed";
};

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
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 28px"><tr><td style="border-radius:12px;background:#1D4ED8">
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;border-radius:12px">${escapeHtml(action)} &rarr;</a>
        </td></tr></table>
        <p style="margin:0 0 24px;color:#64748B;font-size:12px;line-height:18px;word-break:break-all">If the button does not work, paste this link into your browser:<br><a href="${escapeHtml(actionUrl)}" style="color:#1D4ED8;text-decoration:underline">${escapeHtml(actionUrl)}</a></p>`
      : "";

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#F4F7FB;color:#0C1E36;font-family:Arial,'Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(intro)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
        <tr><td style="padding:0 4px 24px;font-size:28px;font-weight:800;letter-spacing:-1px;color:#0C1E36">rive<span style="color:#1D4ED8">.</span></td></tr>
        <tr><td style="overflow:hidden;border:1px solid #DDE7F2;border-radius:20px;background:#FFFFFF">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:8px;background:linear-gradient(90deg,#1D4ED8,#60A5FA)"></td></tr>
            <tr><td style="padding:38px 38px 34px">
              <p style="margin:0 0 12px;color:#1D4ED8;font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase">${escapeHtml(eyebrow)}</p>
              <h1 style="margin:0 0 18px;color:#0C1E36;font-size:32px;line-height:38px;letter-spacing:-1px">${escapeHtml(title)}</h1>
              <p style="margin:0 0 20px;color:#42556F;font-size:16px;line-height:26px">${escapeHtml(intro)}</p>
              ${body}
              ${button}
              ${aside ? `<div style="margin-top:26px;padding:18px 20px;border:1px solid #DDE7F2;border-radius:14px;background:#F7FAFD;color:#42556F;font-size:13px;line-height:21px">${aside}</div>` : ""}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 8px 0;color:#718096;font-size:12px;line-height:19px">
          <p style="margin:0 0 6px">Questions? Reply to this email or write to <a href="mailto:hello@rive.work" style="color:#1D4ED8;text-decoration:none">hello@rive.work</a>.</p>
          <p style="margin:0">&copy; ${new Date().getFullYear()} rive. &middot; Bengaluru, India<br>This message was sent to ${safeRecipient}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

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
    return { sent: false, reason: "not_configured" };
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
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown delivery error";
    console.error(`email: ${type} delivery failed`, error);
    await prisma.emailDelivery
      .create({
        data: { recipient: to, type, status: "failed", error: message },
      })
      .catch((logError) => console.error("email: failed to record delivery error", logError));
    return { sent: false, reason: "delivery_failed" };
  }
}

export function sendWaitlistJoinedEmail(to: string, type: string): Promise<EmailResult> {
  const remit = type === "remit";
  const title = remit ? "You’re on the Remit early-access list." : "Your place is saved.";
  const intro = remit
    ? "Thanks for raising your hand for Remit. We’ll write when early access is ready for you."
    : "Thanks for joining Rive. We’ll review early-access requests in small batches.";
  const body = remit
    ? `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">Remit is being designed to make cross-border payments less painful for independent professionals. We are still building it, so we will only email you when there is a meaningful product update or an invitation to try it.</p>`
    : `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">Rive brings the operational side of independent work together: clients, projects, invoices, expenses, and a public portfolio. If your access is approved, you’ll receive a secure, personal registration link from us.</p>`;

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
      body: `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">Create your account with the secure link below. Your workspace will open immediately, with everything ready for you to start organising clients, work, finances, and your portfolio.</p>`,
      action: "Create my workspace",
      actionUrl: inviteUrl,
      aside: "<strong style=\"color:#0C1E36\">This invitation is personal.</strong> It expires in 7 days and can be used once. If it expires, reply to this email and we’ll help.",
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
        <tr><td style="padding:9px 0;color:#42556F;font-size:15px"><strong style="color:#0C1E36">01</strong>&nbsp;&nbsp;Add a client and the work you’re doing together.</td></tr>
        <tr><td style="padding:9px 0;color:#42556F;font-size:15px"><strong style="color:#0C1E36">02</strong>&nbsp;&nbsp;Track an invoice or expense to see your numbers clearly.</td></tr>
        <tr><td style="padding:9px 0;color:#42556F;font-size:15px"><strong style="color:#0C1E36">03</strong>&nbsp;&nbsp;Shape and publish your portfolio when you’re ready.</td></tr>
      </table>`,
      action: "Open my dashboard",
      actionUrl: `${appUrl}/dashboard`,
      aside: "A practical start beats a perfect setup. Add one real client or project first; you can refine everything later.",
      recipient: to,
    }),
    text: `Welcome to rive., ${name}.\n\nYour workspace is live: ${appUrl}/dashboard\n\nStart by adding one real client or project. Questions? hello@rive.work`,
  });
}

export function sendPasswordResetEmail(to: string, token: string): Promise<EmailResult> {
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return deliver({
    to,
    type: "password_reset",
    subject: "Reset your rive. password",
    html: baseTemplate({
      eyebrow: "password reset",
      title: "Let’s get you back in.",
      intro: "We received a request to reset the password for your rive. account.",
      body: `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">Use the secure button below to choose a new password. For your protection, the link expires in 60 minutes and works only once.</p>`,
      action: "Choose a new password",
      actionUrl: resetUrl,
      aside: "Didn’t request this? You can safely ignore this email. Your current password will continue to work.",
      recipient: to,
    }),
    text: `Reset your rive. password.\n\nThis secure link expires in 60 minutes:\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
  });
}

export function sendPasswordChangedEmail(to: string): Promise<EmailResult> {
  return deliver({
    to,
    type: "password_changed",
    subject: "Your rive. password was changed",
    html: baseTemplate({
      eyebrow: "security notice",
      title: "Your password was changed.",
      intro: "The password for your rive. account has just been updated.",
      body: `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">If you made this change, there’s nothing else to do. You can sign in with your new password immediately.</p>`,
      action: "Sign in to rive.",
      actionUrl: `${appUrl}/login`,
      aside: "If this wasn’t you, contact hello@rive.work immediately so we can help secure your account.",
      recipient: to,
    }),
    text: `Your rive. password was changed.\n\nIf this was you, no action is needed. If not, contact hello@rive.work immediately.`,
  });
}

export function sendLoginSuccessEmail(to: string): Promise<EmailResult> {
  const signedInAt = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return deliver({
    to,
    type: "login_success",
    subject: "New sign-in to your rive. account",
    html: baseTemplate({
      eyebrow: "security notice",
      title: "A new sign-in was completed.",
      intro: `Your rive. account was signed in to on ${signedInAt} IST.`,
      body: `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">If this was you, no action is needed. We send this note so unusual access never goes unnoticed.</p>`,
      action: "Open my dashboard",
      actionUrl: `${appUrl}/dashboard`,
      aside: "Don’t recognise this sign-in? Reset your password immediately, then contact hello@rive.work so we can help review the account.",
      recipient: to,
    }),
    text: `New sign-in to your rive. account on ${signedInAt} IST.\n\nIf this was you, no action is needed. If not, reset your password immediately: ${appUrl}/forgot-password`,
  });
}

export function sendContactMessageEmail(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<EmailResult> {
  const safeName = escapeHtml(input.name);
  const safeEmail = escapeHtml(input.email);
  const safeSubject = escapeHtml(input.subject);
  const safeMessage = escapeHtml(input.message).replace(/\n/g, "<br>");

  return deliver({
    to: "hello@rive.work",
    type: "contact_message",
    subject: `[rive. contact] ${input.subject}`,
    html: baseTemplate({
      eyebrow: "website enquiry",
      title: input.subject,
      intro: `${input.name} sent a message through rive.work.`,
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;color:#42556F;font-size:14px"><strong style="color:#0C1E36">From:</strong> ${safeName} &lt;${safeEmail}&gt;</td></tr>
        <tr><td style="padding:8px 0;color:#42556F;font-size:14px"><strong style="color:#0C1E36">Subject:</strong> ${safeSubject}</td></tr>
        <tr><td style="padding:18px 0 0;color:#42556F;font-size:15px;line-height:25px">${safeMessage}</td></tr>
      </table>`,
      action: "Reply to sender",
      actionUrl: `mailto:${encodeURIComponent(input.email)}`,
      recipient: "hello@rive.work",
    }),
    text: `${input.subject}\n\nFrom: ${input.name} <${input.email}>\n\n${input.message}`,
  });
}

export function sendPortfolioInquiryEmail(input: {
  to: string;
  portfolioName: string;
  visitorName: string;
  visitorEmail: string;
  projectType: string;
  message: string;
}): Promise<EmailResult> {
  const safeVisitorName = escapeHtml(input.visitorName);
  const safeVisitorEmail = escapeHtml(input.visitorEmail);
  const safeProjectType = escapeHtml(input.projectType);
  const safeMessage = escapeHtml(input.message).replace(/\n/g, "<br>");

  return deliver({
    to: input.to,
    type: "portfolio_inquiry",
    subject: `[Portfolio enquiry] ${input.projectType} — ${input.visitorName}`,
    replyToAddress: input.visitorEmail,
    html: baseTemplate({
      eyebrow: "new portfolio enquiry",
      title: `${input.visitorName} would like to work with you.`,
      intro: `A prospective client sent an enquiry through ${input.portfolioName}'s Rive portfolio.`,
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;color:#42556F;font-size:14px"><strong style="color:#0C1E36">From:</strong> ${safeVisitorName} &lt;${safeVisitorEmail}&gt;</td></tr>
        <tr><td style="padding:8px 0;color:#42556F;font-size:14px"><strong style="color:#0C1E36">Project:</strong> ${safeProjectType}</td></tr>
        <tr><td style="padding:18px 0 0;color:#42556F;font-size:15px;line-height:25px">${safeMessage}</td></tr>
      </table>`,
      action: "Reply to enquiry",
      actionUrl: `mailto:${encodeURIComponent(input.visitorEmail)}`,
      aside: "This enquiry came from your public Rive portfolio. Replying to this email will respond directly to the prospective client.",
      recipient: input.to,
    }),
    text: `New portfolio enquiry\n\nFrom: ${input.visitorName} <${input.visitorEmail}>\nProject: ${input.projectType}\n\n${input.message}`,
  });
}

export function sendContractReviewEmail(input: {
  to: string;
  clientName: string;
  ownerName: string;
  contractTitle: string;
  reviewUrl: string;
  expiresAt: Date;
}): Promise<EmailResult> {
  const safeOwner = escapeHtml(input.ownerName);
  const safeTitle = escapeHtml(input.contractTitle);
  const expiry = input.expiresAt.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
  return deliver({
    to: input.to,
    type: "contract_review",
    subject: `${input.ownerName} shared an Agreement for review`,
    html: baseTemplate({
      eyebrow: "Agreement review",
      title: `${safeOwner} shared a draft Agreement with you.`,
      intro: `Please review “${safeTitle}” and leave comments or suggested edits before anyone records acceptance.`,
      body: `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">This is a review link, not an acceptance request. The Agreement will not be marked accepted until the parties review the final version and complete the separate recorded-acceptance step.</p>`,
      action: "Review Agreement",
      actionUrl: input.reviewUrl,
      aside: `This link expires on ${expiry} (IST). If you were not expecting this message, do not record acceptance; contact ${safeOwner} through a trusted channel.`,
      recipient: input.to,
    }),
    text: `${input.ownerName} shared “${input.contractTitle}” for review.\n\nReview it here: ${input.reviewUrl}\n\nThis link expires on ${expiry} IST. This is not an acceptance request.`,
  });
}

export function sendContractSigningEmail(input: {
  to: string;
  signerName: string;
  contractTitle: string;
  signUrl: string;
  expiresAt: Date;
}): Promise<EmailResult> {
  const expiry = input.expiresAt.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
  return deliver({
    to: input.to,
    type: "contract_signing",
    subject: `Recorded acceptance requested: ${input.contractTitle}`,
    html: baseTemplate({
      eyebrow: "recorded acceptance requested",
      title: "An Agreement is ready for your review and acceptance.",
      intro: `Please read the complete Agreement before recording acceptance of “${escapeHtml(input.contractTitle)}”.`,
      body: `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">The acceptance page will show the exact version, the recorded-acceptance consent language, and the acceptance record created when you type your name and confirm. Only the named client and freelancer parties are invited to accept.</p>`,
      action: "Open acceptance page",
      actionUrl: input.signUrl,
      aside: `This link expires on ${expiry} (IST). Do not forward it. If the name or terms are incorrect, ask the sender to void and reissue the acceptance request.`,
      recipient: input.to,
    }),
    text: `Recorded acceptance requested for “${input.contractTitle}”.\n\nOpen the acceptance page: ${input.signUrl}\n\nThis link expires on ${expiry} IST. Do not forward it.`,
  });
}

export function sendContractExecutedEmail(input: {
  to: string;
  recipientName: string;
  contractTitle: string;
  artifactUrl: string;
}): Promise<EmailResult> {
  const safeRecipientName = escapeHtml(input.recipientName);
  return deliver({
    to: input.to,
    type: "contract_executed",
    subject: `Agreement accepted: ${input.contractTitle}`,
    html: baseTemplate({
      eyebrow: "Agreement accepted",
      title: "Both parties have recorded acceptance.",
      intro: `The accepted version of “${escapeHtml(input.contractTitle)}” is ready to download and retain.`,
      body: `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">Hi ${safeRecipientName}, keep the accepted Agreement and its acceptance record with your business records. The parties should also retain any documents or communications incorporated by reference.</p>`,
      action: "View accepted Agreement",
      actionUrl: input.artifactUrl,
      aside: "This message confirms the record created in Rive; it does not replace any legal, tax, identity, or regulatory requirement that applies to the transaction.",
      recipient: input.to,
    }),
    text: `Both parties recorded acceptance for “${input.contractTitle}”.\n\nView the accepted Agreement: ${input.artifactUrl}`,
  });
}

export function sendInvoiceReadyEmail(input: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  currency: string;
  dueDate: Date | null;
}): Promise<EmailResult> {
  const due = input.dueDate
    ? input.dueDate.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })
    : "not specified";
  return deliver({
    to: input.to,
    type: "invoice_ready",
    subject: `Invoice ${input.invoiceNumber} is ready to review`,
    html: baseTemplate({
      eyebrow: "invoice ready",
      title: `Invoice ${input.invoiceNumber} is ready.`,
      intro: `A milestone-linked draft invoice for ${input.clientName} has been generated for review.`,
      body: `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">Amount: <strong style="color:#0C1E36">${escapeHtml(input.currency)} ${escapeHtml(input.total)}</strong><br>Due date: <strong style="color:#0C1E36">${escapeHtml(due)}</strong></p>`,
      action: "Open revenue workspace",
      actionUrl: `${appUrl}/workflow/revenue`,
      aside: "This email is a prompt to review. No invoice is sent to the client automatically by this notification.",
      recipient: input.to,
    }),
    text: `Invoice ${input.invoiceNumber} is ready to review.\n\nAmount: ${input.currency} ${input.total}\nDue: ${due}\n\nOpen revenue workspace: ${appUrl}/workflow/revenue`,
  });
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
  const due = input.dueDate
    ? input.dueDate.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })
    : "not specified";
  const safeClientName = escapeHtml(input.clientName);
  const safeSenderName = escapeHtml(input.senderName);
  return deliver({
    to: input.to,
    type: "invoice_sent",
    subject: `Invoice ${input.invoiceNumber} from ${input.senderName}`,
    html: baseTemplate({
      eyebrow: "invoice",
      title: `Invoice ${input.invoiceNumber}`,
      intro: `${input.senderName} sent an invoice for your review and payment.`,
      body: `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">Hi ${safeClientName}, ${safeSenderName} sent this invoice for your review and payment.<br><br>Amount due: <strong style="color:#0C1E36">${escapeHtml(input.currency)} ${escapeHtml(input.total)}</strong><br>Due date: <strong style="color:#0C1E36">${escapeHtml(due)}</strong></p>`,
      action: input.publicUrl ? "View invoice" : undefined,
      actionUrl: input.publicUrl,
      aside: "The invoice email is a delivery notice. Please verify the sender and payment details using a trusted channel before paying.",
      recipient: input.to,
    }),
    text: `Invoice ${input.invoiceNumber} from ${input.senderName}.\n\nAmount due: ${input.currency} ${input.total}\nDue: ${due}${input.publicUrl ? `\n\nView invoice: ${input.publicUrl}` : ""}\n\nVerify payment details through a trusted channel before paying.`,
  });
}

export function sendContractVoidRequestedEmail(input: {
  to: string;
  recipientName: string;
  contractTitle: string;
  requesterName: string;
  note: string;
  voidUrl: string;
}): Promise<EmailResult> {
  const safeRecipient = escapeHtml(input.recipientName);
  const safeRequester = escapeHtml(input.requesterName);
  const safeNote = escapeHtml(input.note).replace(/\n/g, "<br>");
  return deliver({
    to: input.to,
    type: "contract_void",
    subject: `Void requested: ${input.contractTitle}`,
    html: baseTemplate({
      eyebrow: "void requested",
      title: `${safeRequester} requested to void an accepted Agreement.`,
      intro: `A void request was raised for “${escapeHtml(input.contractTitle)}”. Both parties must agree before it is voided.`,
      body: `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">Hi ${safeRecipient}, use the secure link below to confirm or decline the void. The Agreement stays accepted and fully retained until the other party also confirms.</p><p style="margin:18px 0 0;padding:14px 16px;border:1px solid #DDE7F2;border-radius:12px;background:#F7FAFD;color:#42556F;font-size:13px;line-height:21px"><strong style="color:#0C1E36">Reason:</strong><br>${safeNote}</p>`,
      action: "Review void request",
      actionUrl: input.voidUrl,
      aside: "If you did not expect this message, you can safely ignore it. The Agreement is not voided unless you confirm through the secure link.",
      recipient: input.to,
    }),
    text: `${input.requesterName} requested to void “${input.contractTitle}”.\n\nReason: ${input.note}\n\nReview the void request: ${input.voidUrl}\n\nThe Agreement stays accepted until you confirm.`,
  });
}

export type PreparedEmail = {
  to: string;
  type: EmailType;
  subject: string;
  html: string;
  text: string;
  replyToAddress?: string;
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
      body: `<p style="margin:0;color:#42556F;font-size:15px;line-height:25px">Your account is ready. Verify this email address to open your workspace. The link expires in 24 hours and works only once.</p>`,
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
