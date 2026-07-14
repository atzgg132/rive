import nodemailer from "nodemailer";

const smtpConfigured =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

function welcomeEmailHtml(email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>you're on the list — rive.</title>
</head>
<body style="margin:0;padding:0;background:#F5F8FC;font-family:'Outfit',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F8FC;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:28px;font-weight:800;color:#0C1E36;letter-spacing:-0.5px;">rive<span style="color:#1D4ED8;">.</span></span>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:24px;border:1px solid #E2E8F0;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%);padding:40px 40px 36px;text-align:center;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:3px;text-transform:uppercase;">welcome to rive.</p>
              <h1 style="margin:0;font-size:38px;font-weight:800;color:#ffffff;line-height:1.1;">you're on the list.</h1>
              <p style="margin:16px 0 0;font-size:16px;color:rgba(255,255,255,0.8);line-height:1.5;">we're building something big. you'll be one of the first to know.</p>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:36px 40px;">
              <p style="margin:0 0 20px;font-size:15px;color:#4A5E78;line-height:1.7;">
                hi there 👋 — thanks for joining the <strong style="color:#0C1E36;">rive.</strong> waitlist. your spot is secured.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#4A5E78;line-height:1.7;">
                rive. is your all-in-one operating system for freelance work — projects, clients, invoicing, ai workflows, and international payments, all in one place. we're putting the finishing touches on the alpha and you'll be among the first batch of users.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F8FC;border-radius:16px;margin-bottom:28px;overflow:hidden;">
                <tr><td style="padding:24px 28px;">
                  <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#94A3B8;letter-spacing:2px;text-transform:uppercase;">what's coming in alpha</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr><td style="padding:6px 0;font-size:14px;color:#0C1E36;">✦ &nbsp;gig board — ai-matched freelance projects</td></tr>
                    <tr><td style="padding:6px 0;font-size:14px;color:#0C1E36;">✦ &nbsp;remit payments — send &amp; receive across 47 countries</td></tr>
                    <tr><td style="padding:6px 0;font-size:14px;color:#0C1E36;">✦ &nbsp;ai co-pilot — your intelligent workflow assistant</td></tr>
                    <tr><td style="padding:6px 0;font-size:14px;color:#0C1E36;">✦ &nbsp;client &amp; project management — all in one dashboard</td></tr>
                  </table>
                </td></tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr><td align="center">
                  <a href="https://rive.work" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#1D4ED8,#3B82F6);color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:14px;letter-spacing:0.3px;">visit rive.work →</a>
                </td></tr>
              </table>
              <p style="margin:0;font-size:14px;color:#4A5E78;line-height:1.7;">
                we'll email you when your batch opens. in the meantime, follow us on <a href="#" style="color:#1D4ED8;text-decoration:none;font-weight:600;">twitter</a> and <a href="#" style="color:#1D4ED8;text-decoration:none;font-weight:600;">linkedin</a> for updates.
              </p>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:20px 40px 32px;border-top:1px solid #F1F5F9;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">© 2026 rive. · built with ♥ for the freelance generation.</p>
              <p style="margin:0;font-size:12px;color:#CBD5E1;">you're receiving this because ${email} joined the rive. waitlist.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail(toEmail: string): Promise<void> {
  if (!transporter) {
    console.log(`email: SMTP not configured — skipping welcome email to ${toEmail}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"rive." <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: "you're on the list. welcome to rive. 🎉",
      html: welcomeEmailHtml(toEmail),
    });
    console.log(`email: welcome email sent to ${toEmail}`);
  } catch (err) {
    console.error(`email: failed to send welcome email to ${toEmail}:`, err);
  }
}
