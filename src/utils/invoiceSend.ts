import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";

/** Transient send lock — not an import vocabulary status. */
export const STALE_SENDING_MS = 15 * 60 * 1000;

export const PUBLIC_INVOICE_LINK_STATUSES = [
  "sending",
  "sent",
  "viewed",
  "overdue",
  "partially_paid",
  "paid",
] as const;

const VIEW_FLIP_STATUSES = ["sent", "sending"] as const;

export function isPublicInvoiceLinkAvailable(invoice: {
  status: string;
  sentSnapshot: unknown;
}): boolean {
  return Boolean(invoice.sentSnapshot)
    && (PUBLIC_INVOICE_LINK_STATUSES as readonly string[]).includes(invoice.status);
}

export function hasIssuedInvoiceArtifact(invoice: {
  sentSnapshot: unknown;
  sentAt: Date | null;
}): boolean {
  return invoice.sentSnapshot != null;
}

export async function recordPublicInvoiceView(
  invoice: { id: string; status: string; viewedAt: Date | null },
  ipHash: string,
): Promise<{ status: string; firstView: boolean }> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.invoice.updateMany({
      where: { id: invoice.id, viewedAt: null },
      data: { viewedAt: new Date() },
    });
    const firstView = claimed.count === 1;
    const flipped = await tx.invoice.updateMany({
      where: { id: invoice.id, status: { in: [...VIEW_FLIP_STATUSES] } },
      data: { status: "viewed" },
    });
    if (firstView) {
      await tx.invoiceEvent.create({
        data: { invoiceId: invoice.id, eventType: "viewed", ipHash },
      });
    }
    return { status: flipped.count ? "viewed" : invoice.status, firstView };
  });
}

export async function markInvoiceDeliverySettled(
  outboxId: string,
  outcome: "sent" | "failed",
  providerMessageId?: string | null,
  error?: string | null,
  client: typeof prisma | Prisma.TransactionClient = prisma,
): Promise<void> {
  await client.invoiceDelivery.updateMany({
    where: { id: outboxId },
    data: {
      status: outcome,
      providerMessageId: outcome === "sent" ? providerMessageId || null : null,
      error: outcome === "failed" ? (error || "Email delivery failed.").slice(0, 500) : null,
      sentAt: outcome === "sent" ? new Date() : null,
    },
  });
}

export async function reclaimStaleSendingInvoice(
  id: string,
  userId: string,
  now = new Date(),
): Promise<void> {
  const staleBefore = new Date(now.getTime() - STALE_SENDING_MS);
  await prisma.invoice.updateMany({
    where: { id, userId, status: "sending", updatedAt: { lt: staleBefore } },
    data: {
      // Only the token hash is persisted, so a crashed request cannot recover
      // the public URL. Reissue with a fresh token instead of stranding it.
      status: "draft",
      sentAt: null,
      publicTokenHash: null,
      sentSnapshot: Prisma.JsonNull,
      sentSnapshotAt: null,
    },
  });
}
