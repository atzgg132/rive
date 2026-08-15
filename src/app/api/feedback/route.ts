import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { promptForKey, safeFeedbackContext } from "@/utils/feedback";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().slice(0, max);
  return result || null;
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const promptKey = clean(searchParams.get("promptKey"), 80);
  const feedback = await prisma.feedback.findMany({
    where: { userId: session.userId, ...(promptKey ? { promptKey } : {}) },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, promptKey: true, feedbackType: true, module: true, rating: true, body: true, status: true, createdAt: true },
  });
  return NextResponse.json({ success: true, feedback });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!isRecord(body)) return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });

  const promptKey = clean(body.promptKey, 80) || "";
  const prompt = promptForKey(promptKey);
  if (!prompt) return NextResponse.json({ success: false, message: "That feedback prompt is not available." }, { status: 400 });

  const feedbackType = clean(body.feedbackType, 40) || prompt.type;
  const moduleName = clean(body.module, 60);
  const triggerEvent = clean(body.triggerEvent, 100);
  const feedbackBody = clean(body.body, 4_000);
  const rawRating = body.rating;
  const rating = rawRating === null || rawRating === undefined || rawRating === "" ? null : Number(rawRating);
  const contactAllowed = body.contactAllowed === true;
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return NextResponse.json({ success: false, message: "Rating must be between 1 and 5." }, { status: 400 });
  }
  if (!feedbackBody && rating === null) {
    return NextResponse.json({ success: false, message: "Add a rating or a short note before sending feedback." }, { status: 400 });
  }

  try {
    const feedback = await prisma.$transaction(async (tx) => {
      const created = await tx.feedback.create({
        data: {
          userId: session.userId,
          promptKey,
          feedbackType,
          module: moduleName,
          triggerEvent,
          rating,
          body: feedbackBody,
          contactAllowed,
          context: safeFeedbackContext(body.context),
        },
      });
      await tx.feedbackPromptState.upsert({
        where: { userId_promptKey: { userId: session.userId, promptKey } },
        create: { userId: session.userId, promptKey, shownAt: new Date(), respondedAt: new Date() },
        update: { respondedAt: new Date(), snoozedUntil: null },
      });
      return created;
    });

    await recordProductEvent({
      userId: session.userId,
      eventName: PRODUCT_EVENTS.feedbackSubmitted,
      module: moduleName || prompt.type,
      source: "in_app",
      properties: { promptKey, feedbackType, rating, contactAllowed },
      dedupeKey: `feedback:${feedback.id}`,
    });

    return NextResponse.json({ success: true, feedbackId: feedback.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: false, message: "Feedback could not be saved twice." }, { status: 409 });
    }
    console.error("Feedback create error:", error);
    return NextResponse.json({ success: false, message: "Feedback could not be saved." }, { status: 500 });
  }
}
