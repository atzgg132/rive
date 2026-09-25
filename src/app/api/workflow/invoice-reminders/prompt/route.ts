import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { readJsonBody } from "@/utils/apiBoundary";
import { DEFAULT_INVOICE_REMINDER_SCHEDULE } from "@/lib/domain-vocabulary";

/**
 * The one-time "turn on invoice reminders?" prompt shown after sending an
 * invoice with a due date (#66 PR 2). "Seen" is a nullable timestamp on
 * InvoiceProfile rather than the general FeedbackPromptState registry — this
 * prompt is a single product offer, not a feedback survey.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const action = (parsedBody.body as { action?: unknown }).action;
  if (action !== "enable" && action !== "dismiss") {
    return NextResponse.json({ success: false, message: "action must be \"enable\" or \"dismiss\"." }, { status: 400 });
  }

  const now = new Date();
  const profile = await prisma.invoiceProfile.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      remindersPromptSeenAt: now,
      remindersEnabled: action === "enable",
      reminderSchedule: DEFAULT_INVOICE_REMINDER_SCHEDULE,
    },
    update: {
      remindersPromptSeenAt: now,
      ...(action === "enable" ? { remindersEnabled: true } : {}),
    },
    select: { remindersEnabled: true, reminderSchedule: true },
  });

  return NextResponse.json({ success: true, settings: profile });
}
