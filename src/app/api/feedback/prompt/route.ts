import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { isPromptAvailable, promptForKey } from "@/utils/feedback";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

function clean(value: string | null, max: number): string {
  return (value || "").trim().slice(0, max);
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const key = clean(new URL(req.url).searchParams.get("promptKey"), 80);
  const prompt = promptForKey(key);
  if (!prompt) return NextResponse.json({ success: false, message: "Unknown feedback prompt." }, { status: 400 });

  /* Every prompt for this user, not just this key: the key is derived from the
     current path, so the only way to pace the experience as a whole is to look
     at when *any* prompt was last shown. There are a handful of keys, so this
     stays one small read. */
  const states = await prisma.feedbackPromptState.findMany({ where: { userId: session.userId } });
  const available = isPromptAvailable(states, key);
  if (available) {
    await prisma.feedbackPromptState.upsert({
      where: { userId_promptKey: { userId: session.userId, promptKey: key } },
      create: { userId: session.userId, promptKey: key, shownAt: new Date() },
      update: { shownAt: new Date() },
    });
    await recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.feedbackPromptShown, module: prompt.type, source: "in_app", properties: { promptKey: key } });
  }
  return NextResponse.json({ success: true, available, prompt: available ? prompt : null });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const body = await req.json().catch(() => null) as { promptKey?: unknown; action?: unknown } | null;
  const key = typeof body?.promptKey === "string" ? clean(body.promptKey, 80) : "";
  const action = typeof body?.action === "string" ? clean(body.action, 20) : "";
  if (!promptForKey(key) || !["dismiss", "snooze", "shown"].includes(action)) {
    return NextResponse.json({ success: false, message: "Invalid feedback prompt action." }, { status: 400 });
  }
  const now = new Date();
  await prisma.feedbackPromptState.upsert({
    where: { userId_promptKey: { userId: session.userId, promptKey: key } },
    create: {
      userId: session.userId,
      promptKey: key,
      shownAt: now,
      dismissedAt: action === "dismiss" ? now : null,
      snoozedUntil: action === "snooze" ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : null,
    },
    update: {
      shownAt: now,
      dismissedAt: action === "dismiss" ? now : undefined,
      // "shown" used to clear snoozedUntil, so merely recording an impression
      // cancelled an active snooze and made the prompt eligible again. Only an
      // explicit snooze may write this field.
      snoozedUntil: action === "snooze" ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
    },
  });
  return NextResponse.json({ success: true });
}
