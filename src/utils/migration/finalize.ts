import "server-only";

import { prisma } from "@/utils/db";
import { ensureDefaultCalendar } from "@/utils/calendar";
import { ensurePrefilledPortfolio } from "@/utils/portfolioProvisioning";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import type { CommitOutcome } from "@/utils/migration/commit";

/**
 * Apply the normal activation side effects after an asynchronous import.
 * Every write here is idempotent so a redelivered queue message is harmless.
 */
export async function finalizeMigrationActivation(
  userId: string,
  migrationId: string,
  outcome: CommitOutcome,
): Promise<number> {
  const total = outcome.created.clients
    + outcome.created.projects
    + outcome.created.invoices
    + outcome.created.expenses;
  await Promise.all([
    ensureDefaultCalendar(userId),
    ensurePrefilledPortfolio(userId),
    prisma.user.updateMany({
      where: { id: userId, onboardingStatus: { not: "complete" } },
      data: { onboardingStatus: "complete", onboardingStep: 5 },
    }),
  ]);
  if (outcome.created.clients > 0) {
    await recordActivationEvent(userId, ACTIVATION_EVENTS.firstClientCreated, { source: "migration" });
  }
  if (outcome.created.projects > 0) {
    await recordActivationEvent(userId, ACTIVATION_EVENTS.firstProjectCreated, { source: "migration" });
  }
  if (outcome.created.invoices > 0 || outcome.created.expenses > 0) {
    await recordActivationEvent(userId, ACTIVATION_EVENTS.firstMeaningfulWorkflowCompleted, { source: "migration" });
  }
  if (total > 0) {
    await recordProductEvent({
      userId,
      eventName: PRODUCT_EVENTS.importCommitted,
      module: "migration",
      entityType: "migration",
      entityId: migrationId,
      dataOrigin: "imported",
      dedupeKey: `migration:committed:${migrationId}`,
      properties: { total, linked: outcome.linked, skipped: outcome.skipped },
    });
  }
  return total;
}
