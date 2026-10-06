import "server-only";

import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

export type MigrationWorkOperation = "analyze" | "reanalyze" | "commit";

export type MigrationWorkMessage = {
  version: 1;
  environment: string;
  migrationId: string;
  operation: MigrationWorkOperation;
  inputRevision: number;
  planHash?: string;
};

export function migrationQueueConfigured(): boolean {
  return process.env.MIGRATION_QUEUE_PROVIDER === "netlify"
    ? Boolean(process.env.NETLIFY_SITE_URL && process.env.CRON_SECRET)
    : Boolean(process.env.MIGRATION_QUEUE_URL && process.env.AWS_REGION);
}

/**
 * Put only opaque operational identifiers on the queue. User ids, filenames,
 * source values, and other customer data are deliberately excluded.
 */
export async function enqueueMigrationWork(message: Omit<MigrationWorkMessage, "version" | "environment">): Promise<boolean> {
  const payload: MigrationWorkMessage = {
    version: 1,
    environment: (process.env.APP_ENV || "local").toLowerCase(),
    ...message,
  };
  if (process.env.MIGRATION_QUEUE_PROVIDER === "netlify") {
    const baseUrl = process.env.NETLIFY_SITE_URL;
    const secret = process.env.CRON_SECRET;
    if (!baseUrl || !secret) throw new Error("Netlify migration worker is not configured.");
    const url = new URL("/.netlify/functions/migration-worker-background", baseUrl);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".netlify.app")) {
      throw new Error("Migration worker must use the private Netlify deployment origin.");
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status !== 202) throw new Error("Netlify did not accept migration work.");
    return true;
  }
  const queueUrl = process.env.MIGRATION_QUEUE_URL;
  const region = process.env.AWS_REGION;
  if (!queueUrl || !region) return false;

  await new SQSClient({ region }).send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(payload),
  }));
  return true;
}

export function parseMigrationWorkMessage(value: unknown): MigrationWorkMessage | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const operation = input.operation;
  if (input.version !== 1 || typeof input.environment !== "string" || typeof input.migrationId !== "string") return null;
  if (operation !== "analyze" && operation !== "reanalyze" && operation !== "commit") return null;
  if (!Number.isInteger(input.inputRevision) || Number(input.inputRevision) < 0) return null;
  if (input.planHash !== undefined && typeof input.planHash !== "string") return null;
  return {
    version: 1,
    environment: input.environment.slice(0, 20),
    migrationId: input.migrationId.slice(0, 64),
    operation,
    inputRevision: Number(input.inputRevision),
    planHash: typeof input.planHash === "string" ? input.planHash.slice(0, 128) : undefined,
  };
}
