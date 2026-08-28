import "server-only";

import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { deliverPreparedEmail, type EmailResult, type PreparedEmail } from "@/utils/email";
import { markInvoiceDeliverySettled } from "@/utils/invoiceSend";
import { markInquiryNotificationSettled } from "@/utils/portfolioInquiryNotifications";

const OUTBOX_ALGORITHM = "aes-256-gcm";
const OUTBOX_KEY = crypto
  .createHash("sha256")
  .update(process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-email-outbox-key")
  .digest();

/** A claimed job that never finishes (killed request, SMTP hang) is stuck until this elapses. */
export const STALE_PROCESSING_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 8;
/** EventBridge job runner HTTP timeout is 25s; stop before that so jobs are not left processing. */
export const CRON_PROCESSING_DEADLINE_MS = 15_000;

type EmailDbClient = typeof prisma | Prisma.TransactionClient;

export type ProcessEmailOutboxOptions = {
  limit?: number;
  /** Process this job first (and only this job when set), instead of the oldest queued row. */
  jobId?: string;
  deadlineMs?: number;
  now?: Date;
  deliver?: (email: PreparedEmail) => Promise<EmailResult>;
};

function encryptPayload(payload: PreparedEmail): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(OUTBOX_ALGORITHM, OUTBOX_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptPayload(value: string): PreparedEmail {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid email outbox payload.");
  const decipher = crypto.createDecipheriv(OUTBOX_ALGORITHM, OUTBOX_KEY, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(decrypted) as Partial<PreparedEmail>;
  if (!parsed.to || !parsed.type || !parsed.subject || !parsed.html || !parsed.text) {
    throw new Error("Email outbox payload is incomplete.");
  }
  return parsed as PreparedEmail;
}

export async function enqueueEmail(email: PreparedEmail, client: EmailDbClient = prisma): Promise<string> {
  const job = await client.emailOutbox.create({
    data: {
      recipient: email.to,
      type: email.type,
      encryptedPayload: encryptPayload(email),
    },
    select: { id: true },
  });
  return job.id;
}

function retryDelayMs(attemptsAfterClaim: number): number {
  return Math.min(6 * 60 * 60 * 1000, 2 ** attemptsAfterClaim * 30_000);
}

/**
 * Drain queued transactional mail.
 *
 * Signup and password-reset call this with `jobId` so a backlog of older
 * inquiry jobs cannot starve the message the user is waiting on. The cron
 * worker calls it without `jobId` to walk the queue FIFO, with a deadline so
 * the EventBridge runner's 25s HTTP timeout cannot leave rows stuck in
 * `processing`.
 */
export async function processEmailOutbox(
  limitOrOptions: number | ProcessEmailOutboxOptions = 10,
): Promise<{ claimed: number; sent: number; retried: number; failed: number; reclaimed: number }> {
  const options: ProcessEmailOutboxOptions = typeof limitOrOptions === "number"
    ? { limit: limitOrOptions }
    : limitOrOptions;
  const limit = Math.max(1, Math.min(options.limit ?? 10, 50));
  const now = options.now ?? new Date();
  const deliver = options.deliver ?? deliverPreparedEmail;
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  const startedAt = Date.now();

  const reclaimed = await prisma.emailOutbox.updateMany({
    where: { status: "processing", updatedAt: { lte: staleBefore } },
    data: { status: "queued", attempts: { decrement: 1 } },
  });

  const jobs = await prisma.emailOutbox.findMany({
    where: {
      ...(options.jobId ? { id: options.jobId } : {}),
      status: "queued",
      availableAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: options.jobId ? 1 : limit,
  });
  let sent = 0;
  let retried = 0;
  let failed = 0;
  let claimed = 0;

  for (const job of jobs) {
    if (options.deadlineMs !== undefined && claimed > 0 && Date.now() - startedAt >= options.deadlineMs) {
      break;
    }

    const claimedRow = await prisma.emailOutbox.updateMany({
      where: { id: job.id, status: "queued" },
      data: { status: "processing", attempts: { increment: 1 } },
    });
    if (claimedRow.count !== 1) continue;
    claimed += 1;
    const attemptsAfterClaim = job.attempts + 1;

    try {
      const email = decryptPayload(job.encryptedPayload);
      if (!await isDeliveryStillValid(email)) {
        await prisma.$transaction(async (tx) => {
          await tx.emailOutbox.update({
            where: { id: job.id },
            data: { status: "failed", processedAt: new Date(), lastError: "The protected link was replaced or expired before delivery." },
          });
          await settleNotificationState(tx, job.type, job.id, "failed", "The protected link was replaced or expired before delivery.");
        });
        failed += 1;
        continue;
      }
      const result = await deliver(email);
      if (result.sent) {
        await prisma.$transaction(async (tx) => {
          await tx.emailOutbox.update({
            where: { id: job.id },
            data: { status: "sent", processedAt: new Date(), lastError: null },
          });
          await settleNotificationState(tx, job.type, job.id, "sent", null, result.messageId);
        });
        sent += 1;
        continue;
      }

      const retryable = attemptsAfterClaim < MAX_ATTEMPTS;
      if (retryable) {
        await prisma.emailOutbox.update({
          where: { id: job.id },
          data: {
            status: "queued",
            availableAt: new Date(Date.now() + retryDelayMs(attemptsAfterClaim)),
            lastError: result.reason || "Email delivery failed.",
          },
        });
        retried += 1;
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.emailOutbox.update({
            where: { id: job.id },
            data: {
              status: "failed",
              availableAt: new Date(Date.now() + retryDelayMs(attemptsAfterClaim)),
              lastError: result.reason || "Email delivery failed.",
            },
          });
          await settleNotificationState(tx, job.type, job.id, "failed", result.reason);
        });
        failed += 1;
      }
    } catch (error) {
      const retryable = attemptsAfterClaim < MAX_ATTEMPTS;
      const reason = error instanceof Error ? error.message.slice(0, 500) : "Email outbox processing failed.";
      if (retryable) {
        await prisma.emailOutbox.update({
          where: { id: job.id },
          data: {
            status: "queued",
            availableAt: new Date(Date.now() + retryDelayMs(attemptsAfterClaim)),
            lastError: reason,
          },
        });
        retried += 1;
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.emailOutbox.update({
            where: { id: job.id },
            data: {
              status: "failed",
              availableAt: new Date(Date.now() + retryDelayMs(attemptsAfterClaim)),
              lastError: reason,
            },
          });
          await settleNotificationState(tx, job.type, job.id, "failed", reason);
        });
        failed += 1;
      }
    }
  }

  return { claimed, sent, retried, failed, reclaimed: reclaimed.count };
}

/**
 * Reflects a terminal outbox outcome back onto the record that queued it.
 *
 * Only fires on the states a reader can act on: delivered, or abandoned after
 * the last retry. A retryable failure leaves the record showing "queued",
 * because that is what it still is.
 */
async function settleNotificationState(
  client: EmailDbClient,
  type: string,
  jobId: string,
  outcome: "sent" | "failed",
  reason?: string | null,
  providerMessageId?: string | null,
): Promise<void> {
  if (type === "portfolio_inquiry") await markInquiryNotificationSettled(jobId, outcome, reason, client);
  if (type === "invoice_sent") await markInvoiceDeliverySettled(jobId, outcome, providerMessageId, reason, client);
}

async function isDeliveryStillValid(email: PreparedEmail): Promise<boolean> {
  const guard = email.deliveryGuard;
  if (!guard) return true;
  if (guard.kind === "contract_signing") {
    const activeLink = await prisma.contractReviewLink.findFirst({
      where: {
        signerId: guard.signerId,
        tokenHash: guard.tokenHash,
        type: "sign",
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    return Boolean(activeLink);
  }
  if (guard.kind === "invoice_sent") {
    const invoice = await prisma.invoice.findUnique({
      where: { id: guard.invoiceId },
      select: { status: true, publicTokenHash: true, sentSnapshot: true },
    });
    return Boolean(
      invoice
      && ["sent", "viewed", "overdue"].includes(invoice.status)
      && invoice.publicTokenHash === guard.tokenHash
      && invoice.sentSnapshot,
    );
  }
  return false;
}
