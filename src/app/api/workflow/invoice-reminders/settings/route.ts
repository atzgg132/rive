import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { readJsonBody } from "@/utils/apiBoundary";
import { DEFAULT_INVOICE_REMINDER_SCHEDULE } from "@/lib/domain-vocabulary";
import { sanitizeReminderSchedule } from "@/utils/invoiceReminders";

/**
 * Backs the self-contained `InvoiceRemindersSettings` component (#66 PR 2).
 * Independent of the Business & invoicing settings page PR 1 is building —
 * reads and writes only the reminder-related InvoiceProfile columns.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const profile = await prisma.invoiceProfile.findUnique({
    where: { userId: session.userId },
    select: { remindersEnabled: true, reminderSchedule: true, paidReceiptEnabled: true },
  });
  const sanitizedSchedule = sanitizeReminderSchedule(profile?.reminderSchedule);
  return NextResponse.json({
    success: true,
    settings: {
      remindersEnabled: profile?.remindersEnabled ?? false,
      reminderSchedule: sanitizedSchedule.length ? sanitizedSchedule : DEFAULT_INVOICE_REMINDER_SCHEDULE,
      paidReceiptEnabled: profile?.paidReceiptEnabled ?? false,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body as { remindersEnabled?: unknown; reminderSchedule?: unknown; paidReceiptEnabled?: unknown };

  const data: { remindersEnabled?: boolean; reminderSchedule?: string[]; paidReceiptEnabled?: boolean } = {};
  if (body.remindersEnabled !== undefined) {
    if (typeof body.remindersEnabled !== "boolean") return NextResponse.json({ success: false, message: "remindersEnabled must be a boolean." }, { status: 400 });
    data.remindersEnabled = body.remindersEnabled;
  }
  if (body.paidReceiptEnabled !== undefined) {
    if (typeof body.paidReceiptEnabled !== "boolean") return NextResponse.json({ success: false, message: "paidReceiptEnabled must be a boolean." }, { status: 400 });
    data.paidReceiptEnabled = body.paidReceiptEnabled;
  }
  if (body.reminderSchedule !== undefined) {
    const sanitized = sanitizeReminderSchedule(body.reminderSchedule);
    if (!Array.isArray(body.reminderSchedule) || sanitized.length !== body.reminderSchedule.length) {
      return NextResponse.json({ success: false, message: "reminderSchedule must contain only recognized reminder steps." }, { status: 400 });
    }
    data.reminderSchedule = sanitized;
  }

  const profile = await prisma.invoiceProfile.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      remindersEnabled: data.remindersEnabled ?? false,
      reminderSchedule: data.reminderSchedule ?? DEFAULT_INVOICE_REMINDER_SCHEDULE,
      paidReceiptEnabled: data.paidReceiptEnabled ?? false,
    },
    update: data,
    select: { remindersEnabled: true, reminderSchedule: true, paidReceiptEnabled: true },
  });

  return NextResponse.json({ success: true, settings: profile });
}
