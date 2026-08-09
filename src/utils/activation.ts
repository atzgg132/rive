import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";

export const ACTIVATION_EVENTS = {
  registered: "activation.registered",
  onboardingStarted: "activation.onboarding_started",
  profileSubstantiallyCompleted: "activation.profile_substantially_completed",
  portfolioPublished: "activation.portfolio_published",
  firstClientCreated: "activation.first_client_created",
  firstProjectCreated: "activation.first_project_created",
  firstMeaningfulWorkflowCompleted: "activation.first_meaningful_workflow_completed",
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
    const existing = await prisma.auditEvent.findFirst({
      where: { userId, action },
      select: { id: true },
    });
    if (existing) return;

    await prisma.auditEvent.create({
      data: {
        userId,
        action,
        metadata: metadata ? (metadata as Prisma.InputJsonObject) : undefined,
      },
    });
  } catch (error) {
    // Activation telemetry must never make a valid business mutation fail.
    console.error("Activation event could not be recorded:", error);
  }
}
