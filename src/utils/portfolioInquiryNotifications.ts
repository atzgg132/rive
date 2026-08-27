import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";

/**
 * Keeps a portfolio enquiry's notification state in step with its outbox job.
 *
 * The enquiry is the record that matters and it is committed before any mail is
 * attempted, so this only ever annotates what happened to the notification. It
 * is called by the outbox worker in the same transaction that marks the job
 * terminal, so the enquiry and queue cannot disagree about the outcome.
 */
export async function markInquiryNotificationSettled(
  outboxId: string,
  outcome: "sent" | "failed",
  error?: string | null,
  client: typeof prisma | Prisma.TransactionClient = prisma,
): Promise<void> {
  await client.portfolioInquiry.updateMany({
    // Scoped by outboxId alone: it is the correlation the worker holds, and
    // it is unique per enquiry because each enquiry enqueues exactly one job.
    where: { outboxId },
    data: {
      notificationStatus: outcome,
      notificationError: outcome === "failed" ? (error || "Email delivery failed.").slice(0, 500) : null,
    },
  });
}
