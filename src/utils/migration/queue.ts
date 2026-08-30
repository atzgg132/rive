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
  return Boolean(process.env.MIGRATION_QUEUE_URL && process.env.AWS_REGION);
}

/**
 * Put only opaque operational identifiers on the queue. User ids, filenames,
 * source values, and other customer data are deliberately excluded.
 */
export async function enqueueMigrationWork(message: Omit<MigrationWorkMessage, "version" | "environment">): Promise<boolean> {
  const queueUrl = process.env.MIGRATION_QUEUE_URL;
  const region = process.env.AWS_REGION;
  if (!queueUrl || !region) return false;

  const payload: MigrationWorkMessage = {
    version: 1,
    environment: (process.env.APP_ENV || "local").toLowerCase(),
    ...message,
  };
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
