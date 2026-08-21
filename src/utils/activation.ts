import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { recordProductEvent } from "@/utils/productEvents";

export const ACTIVATION_EVENTS = {
  registered: "activation.registered",
  onboardingStarted: "activation.onboarding_started",
  profileSubstantiallyCompleted: "activation.profile_substantially_completed",
  portfolioPublished: "activation.portfolio_published",
  firstClientCreated: "activation.first_client_created",
  firstProjectCreated: "activation.first_project_created",
  firstMeaningfulWorkflowCompleted: "activation.first_meaningful_workflow_completed",
  guidanceStarted: "guidance.started",
  guidanceSkipped: "guidance.skipped",
  guidanceCompleted: "guidance.completed",
  guideReplayed: "guidance.replayed",
  guideMinimized: "guidance.minimized",
  guideResumed: "guidance.resumed",
  guideStepOpened: "guidance.step_opened",
  guideStepCompleted: "guidance.step_completed",
} as const;

type ActivationMetadata = Record<string, string | number | boolean | null>;

/**
 * Audit-backed activation events keep product analytics honest without making
 * signup itself synonymous with activation. Events are idempotent per user and
 * action so retries from a browser or webhook cannot inflate the funnel.
 */
export async function recordActivationEvent(
  userId: string,
  action: string,
  metadata?: ActivationMetadata,
): Promise<void> {
  try {
    await prisma.auditEvent.upsert({
      where: { userId_action: { userId, action } },
      update: {},
      create: {
        userId,
        action,
        metadata: metadata ? (metadata as Prisma.InputJsonObject) : undefined,
      },
    });
  } catch (error) {
    // Activation telemetry must never make a valid business mutation fail.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    console.error("Activation event could not be recorded:", error);
  }
  await recordProductEvent({
    userId,
    eventName: action,
    module: "activation",
    dedupeKey: `activation:${userId}:${action}`,
    properties: metadata,
  });
}

/**
 * Re-playable guide interactions are intentionally not written through the
 * audit-event upsert. Audit events answer "has this milestone happened?";
 * product events answer "how often did people need this help?". Keeping the
 * two paths separate prevents a unique audit key from deleting the meaning of
 * a second replay or a forgotten step.
 */
export async function recordGuidanceEvent(
  userId: string,
  action: string,
  metadata?: ActivationMetadata,
): Promise<void> {
  await recordProductEvent({
    userId,
    eventName: action,
    module: "activation",
    properties: metadata,
  });
}
