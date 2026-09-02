import "server-only";

import crypto from "crypto";
import { Prisma } from "@prisma/client";

export type InvoiceNumberClient = Prisma.TransactionClient;

const MAX_INTEGER = 2_147_483_647;
const GENERATED_NUMBER_PATTERN = /^[A-Za-z0-9-]+-[0-9]{4}-([0-9]{1,10})$/;

type LockedSequence = {
  nextNumber: number;
};

function normalizeInvoicePrefix(prefix: string): string {
  return prefix.trim().replace(/[^A-Za-z0-9-]/g, "").slice(0, 16) || "INV";
}

function formatInvoiceNumber(prefix: string, issuedAt: Date, number: number): string {
  return `${prefix}-${issuedAt.getFullYear()}-${String(number).padStart(4, "0")}`;
}

/** Return the numeric suffix for a generated-format invoice number. */
export function generatedInvoiceNumberSuffix(value: string): number | null {
  const match = GENERATED_NUMBER_PATTERN.exec(value.trim());
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isInteger(number) && number > 0 && number < MAX_INTEGER ? number : null;
}

/**
 * Create the sequence row if necessary and hold its row lock until the
 * surrounding transaction commits. Every path that writes an invoice uses
 * this lock, including imports and explicit user-provided numbers.
 */
async function lockInvoiceNumberSequence(
  tx: InvoiceNumberClient,
  userId: string,
): Promise<LockedSequence> {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "invoice_number_sequences" ("id", "user_id", "prefix", "next_number", "created_at", "updated_at")
    VALUES (${crypto.randomUUID()}, ${userId}, 'INV', 1, NOW(), NOW())
    ON CONFLICT ("user_id") DO NOTHING
  `);

  const rows = await tx.$queryRaw<Array<{ next_number: number }>>(Prisma.sql`
    SELECT "next_number"
    FROM "invoice_number_sequences"
    WHERE "user_id" = ${userId}
    FOR UPDATE
  `);
  const row = rows[0];
  if (!row) throw new Error("Invoice number sequence could not be initialized.");

  return {
    nextNumber: Math.max(Number(row.next_number) || 1, 1),
  };
}

/**
 * Advance a user's sequence to cover a known invoice number without ever
 * lowering it. This is used for imported and explicitly numbered invoices so
 * future automatic numbers do not drift behind the data already present.
 */
export async function reconcileInvoiceNumberSequence(
  tx: InvoiceNumberClient,
  userId: string,
  knownInvoiceNumbers?: Iterable<string>,
): Promise<void> {
  const sequence = await lockInvoiceNumberSequence(tx, userId);
  const numbers = knownInvoiceNumbers
    ? Array.from(knownInvoiceNumbers)
    : (await tx.invoice.findMany({ where: { userId }, select: { invoiceNumber: true } })).map((invoice) => invoice.invoiceNumber);

  let nextNumber = sequence.nextNumber;
  for (const invoiceNumber of numbers) {
    const suffix = generatedInvoiceNumberSuffix(invoiceNumber);
    if (suffix !== null) nextNumber = Math.max(nextNumber, suffix + 1);
  }

  if (nextNumber !== sequence.nextNumber) {
    await tx.invoiceNumberSequence.update({
      where: { userId },
      data: { nextNumber },
    });
  }
}

/**
 * Claims the next unused number inside the caller's transaction. The sequence
 * row lock serializes all automatic and explicit invoice-number writes, while
 * the exact invoice lookup skips historical/imported collisions.
 */
export async function nextInvoiceNumber(
  tx: InvoiceNumberClient,
  userId: string,
  prefix: string,
  issuedAt = new Date(),
): Promise<string> {
  const normalizedPrefix = normalizeInvoicePrefix(prefix);
  const sequence = await lockInvoiceNumberSequence(tx, userId);
  let candidate = sequence.nextNumber;

  while (candidate < MAX_INTEGER) {
    const invoiceNumber = formatInvoiceNumber(normalizedPrefix, issuedAt, candidate);
    const existing = await tx.invoice.findUnique({
      where: {
        unique_user_invoice_number: {
          userId,
          invoiceNumber,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      await tx.invoiceNumberSequence.update({
        where: { userId },
        data: {
          nextNumber: candidate + 1,
          prefix: normalizedPrefix,
        },
      });
      return invoiceNumber;
    }

    candidate += 1;
  }

  throw new Error("Invoice number sequence is exhausted.");
}
