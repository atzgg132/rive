import "server-only";

import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { deliverPreparedEmail, type PreparedEmail } from "@/utils/email";

const OUTBOX_ALGORITHM = "aes-256-gcm";
const OUTBOX_KEY = crypto
  .createHash("sha256")
  .update(process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-email-outbox-key")
  .digest();

type EmailDbClient = typeof prisma | Prisma.TransactionClient;

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

export async function processEmailOutbox(limit = 10): Promise<{ claimed: number; sent: number; retried: number; failed: number }> {
  const jobs = await prisma.emailOutbox.findMany({
    where: {
      status: "queued",
      availableAt: { lte: new Date() },
      attempts: { lt: 8 },
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 50)),
  });
  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const job of jobs) {
    const claimed = await prisma.emailOutbox.updateMany({
      where: { id: job.id, status: "queued" },
      data: { status: "processing", attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;

    try {
      const result = await deliverPreparedEmail(decryptPayload(job.encryptedPayload));
      if (result.sent) {
        await prisma.emailOutbox.update({
          where: { id: job.id },
          data: { status: "sent", processedAt: new Date(), lastError: null },
        });
        sent += 1;
        continue;
      }

      const retryable = job.attempts + 1 < 8;
      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: {
          status: retryable ? "queued" : "failed",
          availableAt: new Date(Date.now() + Math.min(6 * 60 * 60 * 1000, 2 ** (job.attempts + 1) * 30_000)),
          lastError: result.reason || "Email delivery failed.",
        },
      });
      if (retryable) retried += 1;
      else failed += 1;
    } catch (error) {
      const retryable = job.attempts + 1 < 8;
      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: {
          status: retryable ? "queued" : "failed",
          availableAt: new Date(Date.now() + Math.min(6 * 60 * 60 * 1000, 2 ** (job.attempts + 1) * 30_000)),
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Email outbox processing failed.",
        },
      });
      if (retryable) retried += 1;
      else failed += 1;
    }
  }

  return { claimed: jobs.length, sent, retried, failed };
}

