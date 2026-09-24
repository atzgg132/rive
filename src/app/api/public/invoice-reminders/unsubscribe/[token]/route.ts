import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { getRequestIp, hashRequestValue } from "@/utils/contracts";
import { hashReminderUnsubscribeToken } from "@/utils/invoiceReminders";

/**
 * Client-facing, tokenized opt-out from a business's automated invoice
 * reminders (#66 PR 2). Scoped to the client, not the invoice or the whole
 * mailbox: it never suppresses the original invoice-sent or paid-receipt
 * mail, only future `invoice_reminder` sends from this owner.
 *
 * GET only shows a confirmation page; the opt-out itself is the POST it
 * submits. Mail scanners and link previewers fetch every link in a message,
 * so a GET that unsubscribed would opt clients out without them ever asking.
 */

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}

function page(status: number, message: string, form?: { action: string }): NextResponse {
  const body = form
    ? `<form method="post" action="${escapeHtml(form.action)}" style="margin:0"><button type="submit" style="padding:12px 20px;background:#181511;color:#F7F5ED;border:0;font-weight:700;font-size:14px;cursor:pointer">Stop reminder emails</button></form>`
    : "";
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Invoice reminders</title></head>
<body style="margin:0;background:#F7F5ED;color:#181511;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <main style="max-width:480px;margin:80px auto;padding:32px;border:2px solid #181511;background:#FDFCF7;text-align:center">
    <h1 style="font-size:20px;margin:0 0 12px">Invoice reminders</h1>
    <p style="font-size:15px;line-height:24px;color:#55503F;margin:0 0 20px">${escapeHtml(message)}</p>
    ${body}
  </main>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

async function rateLimited(req: NextRequest, tokenHash: string): Promise<boolean> {
  const ip = getRequestIp(req);
  return !(await durableRateLimit(`invoice-reminder-unsubscribe:${hashRequestValue(tokenHash)}:${hashRequestValue(ip)}`, 10, 60 * 60 * 1000));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = hashReminderUnsubscribeToken(token);
  if (await rateLimited(req, tokenHash)) return page(429, "Too many requests. Try again later.");

  const client = await prisma.client.findUnique({ where: { remindersUnsubscribeTokenHash: tokenHash }, select: { remindersOptedOut: true } });
  if (!client) return page(404, "This unsubscribe link is invalid or has expired.");
  if (client.remindersOptedOut) return page(200, "You are already unsubscribed from automated invoice reminders from this business.");
  return page(200, "Stop automated invoice reminder emails from this business? You will still receive invoices themselves.", {
    action: new URL(req.url).pathname,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = hashReminderUnsubscribeToken(token);
  if (await rateLimited(req, tokenHash)) return page(429, "Too many requests. Try again later.");

  const updated = await prisma.client.updateMany({
    where: { remindersUnsubscribeTokenHash: tokenHash },
    data: { remindersOptedOut: true },
  });
  if (updated.count !== 1) return page(404, "This unsubscribe link is invalid or has expired.");
  return page(200, "Done. You will no longer receive automated invoice reminders from this business.");
}
