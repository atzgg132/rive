import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import {
  ACTIVATION_EVENTS,
  recordActivationEvent,
  recordGuidanceEvent,
} from "@/utils/activation";
import {
  emptyGuideProgress,
  getGuideDefinition,
  isGuideId,
  normalizeGuideProgress,
  type GuideId,
} from "@/lib/guides";
import type { GuideProgress, GuideProgressMap } from "@/lib/activation";

const GUIDANCE_EVENTS = new Set([
  "started",
  "skipped",
  "completed",
  "replayed",
  "minimized",
  "resumed",
  "step_opened",
  "step_completed",
]);
const GUIDANCE_MODES = new Set(["automatic", "manual"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, max = 120): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function validStepIds(guideId: GuideId): Set<string> {
  return new Set(getGuideDefinition(guideId).steps.map((step) => step.id));
}

function requiredStepIds(guideId: GuideId): string[] {
  return getGuideDefinition(guideId).steps.filter((step) => !step.optional).map((step) => step.id);
}

function suppliedCompletedStepIds(value: unknown, valid: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((stepId): stepId is string => typeof stepId === "string" && valid.has(stepId))));
}

function nextStepId(guideId: GuideId, completedStepIds: string[]): string | null {
  const completed = new Set(completedStepIds);
  return getGuideDefinition(guideId).steps.find((step) => !step.optional && !completed.has(step.id))?.id || null;
}

function progressForEvent(
  guideId: GuideId,
  event: string,
  current: GuideProgress,
  stepId: string | null,
  incomingCompleted: string[],
): GuideProgress {
  const now = new Date().toISOString();
  const completedStepIds = Array.from(new Set([...current.completedStepIds, ...incomingCompleted]));
  const required = requiredStepIds(guideId);
  const complete = required.every((id) => completedStepIds.includes(id));
  const next = nextStepId(guideId, completedStepIds);
  const nextProgress: GuideProgress = {
    ...current,
    completedStepIds,
    currentStepId: stepId || (complete ? null : next),
    status: complete || event === "completed" ? "completed" : current.status === "completed" ? "completed" : "in_progress",
    runCount: current.runCount + (event === "started" || event === "replayed" ? 1 : 0),
    lastSeenAt: now,
  };
  if (complete || event === "completed") nextProgress.completedAt = now;
  return nextProgress;
}

function updateProgressForEvent(
  guideId: GuideId,
  event: string,
  current: GuideProgress,
  stepId: string | null,
  incomingCompleted: string[],
): GuideProgress {
  if (event === "skipped" || event === "minimized") {
    return { ...current, lastSeenAt: new Date().toISOString() };
  }
  if (event === "step_opened") {
    return {
      ...current,
      currentStepId: stepId || current.currentStepId,
      status: current.status === "completed" ? "completed" : "in_progress",
      lastSeenAt: new Date().toISOString(),
    };
  }
  if (event === "resumed") {
    return {
      ...current,
      currentStepId: current.currentStepId || nextStepId(guideId, current.completedStepIds),
      status: current.status === "completed" ? "completed" : "in_progress",
      lastSeenAt: new Date().toISOString(),
    };
  }
  return progressForEvent(guideId, event, current, stepId, incomingCompleted);
}

function actionForEvent(event: string, mode: string): string {
  if (event === "started") return mode === "manual" ? ACTIVATION_EVENTS.guideReplayed : ACTIVATION_EVENTS.guidanceStarted;
  if (event === "skipped") return ACTIVATION_EVENTS.guidanceSkipped;
  if (event === "completed") return ACTIVATION_EVENTS.guidanceCompleted;
  if (event === "replayed") return ACTIVATION_EVENTS.guideReplayed;
  if (event === "minimized") return ACTIVATION_EVENTS.guideMinimized;
  if (event === "resumed") return ACTIVATION_EVENTS.guideResumed;
  if (event === "step_completed") return ACTIVATION_EVENTS.guideStepCompleted;
  return ACTIVATION_EVENTS.guideStepOpened;
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!isRecord(body) || typeof body.event !== "string" || !GUIDANCE_EVENTS.has(body.event)) {
    return NextResponse.json({ success: false, message: "Unsupported guidance event." }, { status: 400 });
  }

  const event = body.event;
  const mode = typeof body.mode === "string" && GUIDANCE_MODES.has(body.mode) ? body.mode : "automatic";
  const requestedGuideId = stringValue(body.guideId);
  const guideId: GuideId = requestedGuideId && isGuideId(requestedGuideId) ? requestedGuideId : "getting_started";
  const valid = validStepIds(guideId);
  const stepId = stringValue(body.stepId);
  if (stepId && !valid.has(stepId)) {
    return NextResponse.json({ success: false, message: "That guide step is no longer available." }, { status: 400 });
  }
  const incomingCompleted = suppliedCompletedStepIds(body.completedStepIds, valid);

  const current = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { onboardingData: true },
  });
  const existing = current?.onboardingData && typeof current.onboardingData === "object" && !Array.isArray(current.onboardingData)
    ? current.onboardingData as Record<string, unknown>
    : {};
  const guideProgress = normalizeGuideProgress(existing.guideProgress);
  const currentProgress = guideProgress[guideId] || emptyGuideProgress();

  if (event === "completed") {
    const required = requiredStepIds(guideId);
    const completed = new Set([...currentProgress.completedStepIds, ...incomingCompleted]);
    if (required.some((id) => !completed.has(id))) {
      return NextResponse.json(
        { success: false, message: "Finish the guide's required steps before marking it complete." },
        { status: 409 },
      );
    }
  }

  const nextProgress = updateProgressForEvent(guideId, event, currentProgress, stepId, incomingCompleted);
  const nextGuideProgress: GuideProgressMap = { ...guideProgress, [guideId]: nextProgress };
  const nextData: Record<string, unknown> = {
    ...existing,
    guideProgress: nextGuideProgress,
  };

  if (mode === "automatic" && event === "skipped") {
    nextData.guidanceDismissed = true;
  }
  if (mode === "automatic" && event === "completed") {
    nextData.guidanceCompleted = true;
    nextData.guidanceDismissed = false;
  }

  // Progress is user state, not analytics. Persist it for every interaction
  // that can change or resume a guide, while leaving profile/onboarding fields
  // untouched in the same JSON document.
  if (["started", "skipped", "completed", "replayed", "minimized", "resumed", "step_opened", "step_completed"].includes(event)) {
    await prisma.user.update({ where: { id: session.userId }, data: { onboardingData: nextData as unknown as Prisma.InputJsonValue } });
  }

  const action = actionForEvent(event, mode);
  const metadata = {
    guideId,
    mode,
    ...(stepId ? { stepId } : {}),
    ...(event === "step_completed" || event === "completed" ? { completedSteps: nextProgress.completedStepIds.length } : {}),
  };
  if (["started", "skipped", "completed"].includes(event) && !(event === "started" && mode === "manual")) {
    await recordActivationEvent(session.userId, action, metadata);
  } else {
    await recordGuidanceEvent(session.userId, action, metadata);
  }

  return NextResponse.json({ success: true, guideProgress: nextGuideProgress, guide: nextProgress });
}
