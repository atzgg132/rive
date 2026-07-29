import nodemailer from "nodemailer";

const provider = (process.env.EMAIL_PROVIDER || "smtp").toLowerCase();
const host = process.env.SMTP_HOST || "";
const port = Number.parseInt(process.env.SMTP_PORT || (provider === "zoho" ? "465" : "587"), 10);
const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
const user = process.env.SMTP_USER || "";
const password = process.env.SMTP_PASS || "";
const from = process.env.EMAIL_FROM || `"rive." <${user || "hello@rive.work"}>`;
const sendIndex = process.argv.indexOf("--send");
const recipient = sendIndex >= 0 ? process.argv[sendIndex + 1] : "";

if (!["smtp", "zoho"].includes(provider)) {
  console.error(`EMAIL_PROVIDER is "${provider}". Set it to "zoho" or "smtp" for this diagnostic.`);
  process.exitCode = 1;
} else if (!host || !user || !password || !Number.isSafeInteger(port)) {
  const missing = [
    !host && "SMTP_HOST",
    !user && "SMTP_USER",
    !password && "SMTP_PASS",
    !Number.isSafeInteger(port) && "SMTP_PORT",
  ].filter(Boolean);
  console.error(`Email configuration is incomplete. Missing or invalid: ${missing.join(", ")}.`);
  process.exitCode = 1;
} else {
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: { user, pass: password },
    tls: { minVersion: "TLSv1.2", servername: host },
  });

  try {
    await transport.verify();
    console.log(`SMTP verified: ${host}:${port} (${secure ? "SSL" : "STARTTLS"}) as ${user}.`);
    if (recipient) {
      const result = await transport.sendMail({
        from,
        to: recipient,
        replyTo: process.env.EMAIL_REPLY_TO || "hello@rive.work",
        subject: "rive. email delivery test",
        text: "Email delivery is working. This message was sent by the Rive SMTP diagnostic.",
        html: '<div style="font-family:Arial,sans-serif;padding:32px;color:#0C1E36"><h1 style="margin:0 0 12px">Email delivery is working.</h1><p style="margin:0;color:#42556F">This message was sent by the Rive SMTP diagnostic.</p></div>',
      });
      console.log(`Test email accepted for ${recipient}. Message ID: ${result.messageId}`);
    }
  } catch (error) {
    console.error("SMTP verification failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    transport.close();
  }
}
