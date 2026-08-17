import "server-only";

import { prisma } from "@/utils/db";

/**
 * Keeps a portfolio enquiry's notification state in step with its outbox job.
 *
 * The enquiry is the record that matters and it is committed before any mail is
 * attempted, so this only ever annotates what happened to the notification. It
 * is called by the outbox worker as each job reaches a terminal state, which is
 * why it is deliberately tiny and never throws: a bookkeeping failure must not
 * stop the worker from draining the rest of the queue.
 */
export async function markInquiryNotificationSettled(
  outboxId: string,
  outcome: "sent" | "failed",
  error?: string | null,
): Promise<void> {
  try {
    await prisma.portfolioInquiry.updateMany({
      // Scoped by outboxId alone: it is the correlation the worker holds, and
      // it is unique per enquiry because each enquiry enqueues exactly one job.
      where: { outboxId },
      data: {
        notificationStatus: outcome,
        notificationError: outcome === "failed" ? (error || "Email delivery failed.").slice(0, 500) : null,
      },
    });
  } catch (updateError) {
    console.error("Could not record portfolio inquiry notification state:", updateError);
  }
}
