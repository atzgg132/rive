import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";

const GUIDANCE_EVENTS = new Set(["started", "skipped", "completed", "replayed"]);
const GUIDANCE_MODES = new Set(["automatic", "manual"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!isRecord(body) || typeof body.event !== "string" || !GUIDANCE_EVENTS.has(body.event)) {
    return NextResponse.json({ success: false, message: "Unsupported guidance event." }, { status: 400 });
  }
  const mode = typeof body.mode === "string" && GUIDANCE_MODES.has(body.mode) ? body.mode : "automatic";
  const guideId = typeof body.guideId === "string" ? body.guideId.slice(0, 80) : "getting_started";

  if (mode === "automatic" && (body.event === "skipped" || body.event === "completed")) {
    const current = await prisma.user.findUnique({ where: { id: session.userId }, select: { onboardingData: true } });
    const existing = current?.onboardingData && typeof current.onboardingData === "object" && !Array.isArray(current.onboardingData)
      ? current.onboardingData as Record<string, unknown>
      : {};
    const nextData = {
      ...existing,
      ...(body.event === "skipped" ? { guidanceDismissed: true } : { guidanceCompleted: true, guidanceDismissed: false }),
    };
    await prisma.user.update({ where: { id: session.userId }, data: { onboardingData: nextData } });
  }

  const action = body.event === "started"
    ? (mode === "manual" ? ACTIVATION_EVENTS.guideReplayed : ACTIVATION_EVENTS.guidanceStarted)
    : body.event === "skipped"
      ? ACTIVATION_EVENTS.guidanceSkipped
      : body.event === "completed"
        ? ACTIVATION_EVENTS.guidanceCompleted
        : ACTIVATION_EVENTS.guideReplayed;
  await recordActivationEvent(session.userId, action, { guideId, mode });

  return NextResponse.json({ success: true });
}
