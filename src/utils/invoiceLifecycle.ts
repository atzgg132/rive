import "server-only";

import { prisma } from "@/utils/db";

/**
 * Keep the displayed lifecycle honest without relying on a frontend-only
 * derived label. A scheduler can call this globally; workspace reads call it
 * for one user so overdue state is also correct during local development.
 */
export async function refreshOverdueInvoices(userId?: string): Promise<number> {
  const now = new Date();
  const candidates = await prisma.invoice.findMany({
    where: {
      ...(userId ? { userId } : {}),
      dueDate: { lt: now },
      status: { in: ["sent", "viewed"] },
    },
    select: { id: true, userId: true },
    take: 500,
  }).catch(() => [] as Array<{ id: string; userId: string }>);

  if (!candidates.length) return 0;
  let updatedCount = 0;
  await prisma.$transaction(async (tx) => {
    for (const candidate of candidates) {
      const updated = await tx.invoice.updateMany({
        where: { id: candidate.id, status: { in: ["sent", "viewed"] } },
        data: { status: "overdue" },
      });
      if (updated.count) {
        updatedCount += 1;
        await tx.invoiceEvent.create({ data: { invoiceId: candidate.id, userId: candidate.userId, eventType: "overdue", metadata: { source: "lifecycle_refresh" } } });
      }
    }
  });
  return updatedCount;
}
