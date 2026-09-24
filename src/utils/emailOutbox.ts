import "server-only";

import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { normalizeEmailAddress } from "@/lib/email-address";
import { deliverPreparedEmail, type EmailResult, type PreparedEmail } from "@/utils/email";
import { markInvoiceDeliverySettled } from "@/utils/invoiceSend";
import { markInquiryNotificationSettled } from "@/utils/portfolioInquiryNotifications";

const OUTBOX_ALGORITHM = "aes-256-gcm";
const LEGACY_OUTBOX_SECRET = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-email-outbox-key";
function outboxKeys() {
  return [
    { id: process.env.EMAIL_OUTBOX_KEY_ID || "v1", secret: process.env.EMAIL_OUTBOX_KEY || LEGACY_OUTBOX_SECRET },
    ...(process.env.EMAIL_OUTBOX_KEY_PREVIOUS
      ? [{ id: process.env.EMAIL_OUTBOX_KEY_PREVIOUS_ID || "v1", secret: process.env.EMAIL_OUTBOX_KEY_PREVIOUS }]
      : []),
  ].map((key) => ({ ...key, material: crypto.createHash("sha256").update(key.secret).digest() }));
}

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
  const key = outboxKeys()[0];
  if (!key) throw new Error("Email outbox encryption is not configured.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(OUTBOX_ALGORITHM, key.material, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [key.id, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptWithKey(key: { material: Buffer }, ivValue: string, tagValue: string, encryptedValue: string): string {
  const decipher = crypto.createDecipheriv(OUTBOX_ALGORITHM, key.material, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function decryptPayload(value: string): PreparedEmail {
  const parts = value.split(".");
  const versioned = parts.length === 4;
  const keyId = versioned ? parts[0] : null;
  const [ivValue, tagValue, encryptedValue] = versioned ? parts.slice(1) : parts;
  if (!ivValue || !tagValue || !encryptedValue || (versioned && !keyId)) {
    throw new Error("Invalid email outbox payload.");
  }

  const configuredKeys = outboxKeys();
  const keys = keyId ? configuredKeys.filter((key) => key.id === keyId) : configuredKeys;
  let decrypted: string | null = null;
  for (const key of keys) {
    try {
      decrypted = decryptWithKey(key, ivValue, tagValue, encryptedValue);
      break;
    } catch {}
  }
  if (decrypted === null) throw new Error("Email outbox payload cannot be decrypted.");

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

async function recipientSuppressed(recipient: string): Promise<boolean> {
  const email = normalizeEmailAddress(recipient);
  if (!email) return false;
  const suppression = await prisma.emailSuppression.findUnique({
    where: { email },
    select: { id: true },
  });
  return Boolean(suppression);
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
      if (await recipientSuppressed(job.recipient)) {
        await prisma.$transaction(async (tx) => {
          await tx.emailOutbox.update({
            where: { id: job.id },
            data: { status: "failed", processedAt: new Date(), lastError: "Recipient is suppressed." },
          });
          await settleNotificationState(tx, job.type, job.id, "failed", "Recipient is suppressed.");
        });
        failed += 1;
        continue;
      }

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

      const lastError = result.providerCode ? `${result.reason}:${result.providerCode}` : result.reason;
      const terminal = !result.retryable || attemptsAfterClaim >= MAX_ATTEMPTS;
      if (!terminal) {
        await prisma.emailOutbox.update({
          where: { id: job.id },
          data: {
            status: "queued",
            availableAt: new Date(Date.now() + retryDelayMs(attemptsAfterClaim)),
            lastError,
          },
        });
        retried += 1;
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.emailOutbox.update({
            where: { id: job.id },
            data: {
              status: "failed",
              processedAt: new Date(),
              lastError,
            },
          });
          await settleNotificationState(tx, job.type, job.id, "failed", lastError);
        });
        failed += 1;
      }
    } catch (error) {
      const retryable = attemptsAfterClaim < MAX_ATTEMPTS;
      const reason = (error instanceof Error ? error.message : "Email outbox processing failed.")
        .replace(/\S*@\S*/g, "[redacted-email]")
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500) || "Email outbox processing failed.";
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
              processedAt: new Date(),
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

export type EmailOutboxMetrics = {
  /** Age of the oldest queued job that is ready to send now; 0 when none is waiting. */
  oldestQueuedSeconds: number;
  /** Rows currently claimed by a worker — the stuck-work signal. */
  processingCount: number;
  /** Terminal failures in the trailing hour. */
  terminalFailuresLastHour: number;
};

const TERMINAL_FAILURE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Queue-depth snapshot for the cron run. Kept as plain findMany calls so the
 * shape is testable on the in-memory client; these run once per minute, so the
 * extra round trips are cheap.
 */
export async function collectEmailOutboxMetrics(now: Date = new Date()): Promise<EmailOutboxMetrics> {
  const cutoff = new Date(now.getTime() - TERMINAL_FAILURE_WINDOW_MS);
  const [oldestQueued, processing, terminalFailures] = await Promise.all([
    prisma.emailOutbox.findMany({
      where: { status: "queued", availableAt: { lte: now } },
      orderBy: { createdAt: "asc" },
      take: 1,
      select: { createdAt: true },
    }),
    prisma.emailOutbox.findMany({ where: { status: "processing" }, select: { id: true } }),
    prisma.emailOutbox.findMany({ where: { status: "failed", processedAt: { gt: cutoff } }, select: { id: true } }),
  ]);
  return {
    oldestQueuedSeconds: oldestQueued[0]?.createdAt
      ? Math.max(0, Math.round((now.getTime() - oldestQueued[0].createdAt.getTime()) / 1000))
      : 0,
    processingCount: processing.length,
    terminalFailuresLastHour: terminalFailures.length,
  };
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
  if (type === "contact_message") {
    await client.contactMessage.updateMany({
      where: { outboxId: jobId },
      data: {
        notificationStatus: outcome,
        notificationError: outcome === "failed" ? (reason || "Email delivery failed.").slice(0, 500) : null,
      },
    });
  }
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
  if (guard.kind === "contract_review") {
    const activeLink = await prisma.contractReviewLink.findFirst({
      where: {
        id: guard.linkId,
        tokenHash: guard.tokenHash,
        type: "review",
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    return Boolean(activeLink);
  }
  if (guard.kind === "contract_void") {
    const activeLink = await prisma.contractReviewLink.findFirst({
      where: {
        id: guard.linkId,
        tokenHash: guard.tokenHash,
        type: "void",
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
