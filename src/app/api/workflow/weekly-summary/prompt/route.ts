import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { readJsonBody } from "@/utils/apiBoundary";

/**
 * "Have you seen this yet" state for the weekly-summary opt-in card, stored on
 * `FeedbackPromptState` under its own `promptKey` — the same table the
 * feedback widget uses to avoid re-asking, rather than a parallel mechanism.
 * Unlike the feedback prompts, this key is never paced against the others:
 * it is a one-time informational card, not a recurring ask, so it only ever
 * needs "has this been shown to this user before".
 */
export const WEEKLY_SUMMARY_OPTIN_PROMPT_KEY = "weekly_summary_optin";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  // Create-and-catch rather than check-then-create: two GETs racing (React 18
  // dev StrictMode double-invokes effects; a fast double-mount can do the
  // same in production) must not both see "no row yet" and both try to
  // report `available: true`. The unique `(userId, promptKey)` constraint is
  // the arbiter — whichever request loses the race gets `available: false`.
  try {
    await prisma.feedbackPromptState.create({
      data: { userId: session.userId, promptKey: WEEKLY_SUMMARY_OPTIN_PROMPT_KEY, shownAt: new Date() },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: true, available: false });
    }
    throw error;
  }
  await recordProductEvent({
    userId: session.userId,
    eventName: PRODUCT_EVENTS.weeklySummaryOptinShown,
    module: "weekly_summary",
    source: "dashboard",
  });
  return NextResponse.json({ success: true, available: true });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const action = typeof parsedBody.body.action === "string" ? parsedBody.body.action : "";
  if (!["dismiss", "accepted"].includes(action)) {
    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  }
  const now = new Date();
  await prisma.feedbackPromptState.upsert({
    where: { userId_promptKey: { userId: session.userId, promptKey: WEEKLY_SUMMARY_OPTIN_PROMPT_KEY } },
    create: {
      userId: session.userId,
      promptKey: WEEKLY_SUMMARY_OPTIN_PROMPT_KEY,
      shownAt: now,
      dismissedAt: now,
      respondedAt: action === "accepted" ? now : null,
    },
    update: {
      dismissedAt: now,
      respondedAt: action === "accepted" ? now : undefined,
    },
  });
  return NextResponse.json({ success: true });
}
