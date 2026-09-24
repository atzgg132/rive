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
 */
async function handle(req: NextRequest, token: string) {
  const ip = getRequestIp(req);
  const tokenHash = hashReminderUnsubscribeToken(token);
  if (!(await durableRateLimit(`invoice-reminder-unsubscribe:${hashRequestValue(tokenHash)}:${hashRequestValue(ip)}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ success: false, message: "Too many requests. Try again later." }, { status: 429 });
  }

  const updated = await prisma.client.updateMany({
    where: { remindersUnsubscribeTokenHash: tokenHash },
    data: { remindersOptedOut: true },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ success: false, message: "This unsubscribe link is invalid or has expired." }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: "You will no longer receive automated invoice reminders from this business." });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handle(req, token);
}

// A one-click unsubscribe link is normally opened in a browser (GET). Support
// both so the same link works whether the client's mail client prefetches it
// or the confirmation page submits a POST.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handle(req, token);
}
