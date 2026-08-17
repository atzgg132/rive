import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { feedbackSubmitCooldownKey, formatCooldownRemaining } from "@/utils/feedback";
import { peekDurableRateLimit } from "@/utils/durableRateLimit";

/**
 * "Can I send feedback right now, and if not, when?"
 *
 * One a day is the rule, but the widget only learned it by submitting and being
 * refused — so someone would rate the product, write a paragraph, press send,
 * and only then be told to come back tomorrow. Asking first turns that into a
 * calm sentence before any typing happens.
 *
 * Read-only by construction: it peeks at the window rather than calling the
 * limiter, because calling the limiter to ask whether you are limited would
 * spend the allowance it is reporting on.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const status = await peekDurableRateLimit(feedbackSubmitCooldownKey(session.userId), 1);
  const seconds = status.retryAfterSeconds ?? 0;

  return NextResponse.json({
    success: true,
    active: status.active,
    retryAt: status.resetAt?.toISOString() ?? null,
    retryAfterSeconds: status.active ? seconds : null,
    message: status.active
      ? `Thanks — you've already shared feedback today. You can send more ${formatCooldownRemaining(seconds)}.`
      : null,
  });
}
