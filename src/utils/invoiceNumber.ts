import "server-only";

import crypto from "crypto";
import { Prisma } from "@prisma/client";

type InvoiceNumberClient = Prisma.TransactionClient;

/**
 * Claims the next number inside the caller's transaction. The conditional
 * insert makes first-use safe under concurrent requests; the atomic increment
 * ensures two invoice creates can never receive the same sequence value.
 */
export async function nextInvoiceNumber(
  tx: InvoiceNumberClient,
  userId: string,
  prefix: string,
  issuedAt = new Date(),
): Promise<string> {
  const normalizedPrefix = prefix.trim().replace(/[^A-Za-z0-9-]/g, "").slice(0, 16) || "INV";
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "invoice_number_sequences" ("id", "user_id", "prefix", "next_number", "created_at", "updated_at")
    VALUES (${crypto.randomUUID()}, ${userId}, ${normalizedPrefix}, 1, NOW(), NOW())
    ON CONFLICT ("user_id") DO NOTHING
  `);
  const sequence = await tx.invoiceNumberSequence.update({
    where: { userId },
    data: { nextNumber: { increment: 1 }, prefix: normalizedPrefix },
    select: { nextNumber: true, prefix: true },
  });
  const claimedNumber = sequence.nextNumber - 1;
  return `${sequence.prefix}-${issuedAt.getFullYear()}-${String(claimedNumber).padStart(4, "0")}`;
}
