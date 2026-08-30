import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/utils/db";
import { analyzeMigration, persistSources, StaleMigrationInputError } from "@/utils/migration/analyze";
import { commitMigration } from "@/utils/migration/commit";
import { finalizeMigrationActivation } from "@/utils/migration/finalize";
import { ingestUploads } from "@/utils/migration/ingest";
import { enqueueMigrationWork, type MigrationWorkMessage } from "@/utils/migration/queue";
import { readMigrationObject } from "@/utils/migration/uploads";

const LEASE_MS = 12 * 60 * 1000;

class CommitBatchError extends Error {}

export type MigrationWorkOutcome = {
  accepted: boolean;
  status: string;
  message?: string;
};

function safeCode(error: unknown): string {
  if (error instanceof StaleMigrationInputError) return "stale_input";
  if (error instanceof CommitBatchError) return "batch_failed";
  return "worker_failed";
}

async function claim(message: MigrationWorkMessage): Promise<string | null> {
  const leaseId = randomUUID();
  const now = new Date();
  const expectedStatus = message.operation === "commit" ? "queued_commit" : "queued_analysis";
  const failurePhase = message.operation === "commit" ? "commit" : "analysis";
  const resumableInFlight = message.operation === "commit" ? ["committing"] : ["profiling", "mapping"];
  const result = await prisma.importJob.updateMany({
    where: {
      id: message.migrationId,
      engineVersion: 2,
      inputRevision: message.inputRevision,
      AND: [
        {
          OR: [
            { status: expectedStatus },
            { status: "failed", failurePhase },
            { status: { in: resumableInFlight } },
          ],
        },
        {
          OR: [{ workerLeaseExpiresAt: null }, { workerLeaseExpiresAt: { lt: now } }],
        },
      ],
    },
    data: {
      status: message.operation === "commit" ? "queued_commit" : "profiling",
      workerLeaseId: leaseId,
      workerLeaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      lastHeartbeatAt: now,
      attemptCount: { increment: 1 },
      phase: message.operation === "commit" ? "queued_commit" : "ingest",
      completedAt: null,
    },
  });
  return result.count === 1 ? leaseId : null;
}

async function ingestDurableFiles(migrationId: string, leaseId: string): Promise<void> {
  const job = await prisma.importJob.findUniqueOrThrow({
    where: { id: migrationId },
    include: { files: { orderBy: { createdAt: "asc" } } },
  });
  const uploads = Array.from(
    new Map(
      job.files
        .filter((file) => file.objectKey && file.uploadStatus === "verified")
        .map((file) => [file.objectKey as string, file]),
    ).values(),
  );
  if (!uploads.length) return;

  await prisma.importJob.update({
    where: { id: migrationId },
    data: { progressCompleted: 0, progressTotal: uploads.length, phase: "ingest", lastHeartbeatAt: new Date() },
  });

  const browserFiles: File[] = [];
  for (let index = 0; index < uploads.length; index += 1) {
    const upload = uploads[index];
    const bytes = await readMigrationObject(upload.objectKey!);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    browserFiles.push(new File([body], upload.name, { type: upload.mimeType }));
    await prisma.importJob.updateMany({
      where: { id: migrationId, workerLeaseId: leaseId },
      data: {
        progressCompleted: index + 1,
        lastHeartbeatAt: new Date(),
        workerLeaseExpiresAt: new Date(Date.now() + LEASE_MS),
      },
    });
  }

  const ingested = await ingestUploads(browserFiles);
  if (!ingested.ok) throw new Error(ingested.message);
  for (const source of ingested.sources) {
    source.objectKey = uploads.find((upload) => upload.checksum === source.checksum && upload.name === source.fileName)?.objectKey || undefined;
  }
  await persistSources(migrationId, ingested.sources);
}

async function runAnalysis(message: MigrationWorkMessage, leaseId: string): Promise<MigrationWorkOutcome> {
  try {
    await ingestDurableFiles(message.migrationId, leaseId);
    await prisma.importJob.updateMany({
      where: { id: message.migrationId, workerLeaseId: leaseId },
      data: { phase: "analysis", lastHeartbeatAt: new Date(), workerLeaseExpiresAt: new Date(Date.now() + LEASE_MS) },
    });
    // Internal work derives the owner from the retained job rather than
    // trusting a queue message to carry tenant identity.
    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: message.migrationId }, select: { userId: true } });
    const result = await analyzeMigration(job.userId, message.migrationId, message.inputRevision);
    await prisma.importJob.updateMany({
      where: { id: message.migrationId, workerLeaseId: leaseId },
      data: { workerLeaseId: null, workerLeaseExpiresAt: null, lastHeartbeatAt: new Date() },
    });
    return { accepted: true, status: result.state };
  } catch (error) {
    if (error instanceof StaleMigrationInputError) {
      const current = await prisma.importJob.findUnique({ where: { id: message.migrationId }, select: { inputRevision: true } });
      if (current) {
        await prisma.importJob.update({
          where: { id: message.migrationId },
          data: { status: "queued_analysis", phase: "queued_analysis", workerLeaseId: null, workerLeaseExpiresAt: null },
        });
        await enqueueMigrationWork({ migrationId: message.migrationId, operation: "reanalyze", inputRevision: current.inputRevision });
      }
      return { accepted: true, status: "queued_analysis" };
    }
    const messageText = error instanceof Error ? error.message.slice(0, 500) : "Analysis failed.";
    await prisma.importJob.updateMany({
      where: { id: message.migrationId, workerLeaseId: leaseId },
      data: {
        status: "failed",
        phase: "recovery",
        failurePhase: "analysis",
        failureCode: safeCode(error),
        error: messageText,
        workerLeaseId: null,
        workerLeaseExpiresAt: null,
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function runCommit(message: MigrationWorkMessage, leaseId: string): Promise<MigrationWorkOutcome> {
  const job = await prisma.importJob.findUnique({ where: { id: message.migrationId }, select: { userId: true, planHash: true } });
  if (!job) return { accepted: true, status: "missing" };
  const planHash = message.planHash || job.planHash || "";
  try {
    const outcome = await commitMigration(job.userId, message.migrationId, planHash);
    if (outcome.status === "conflict") {
      await prisma.importJob.updateMany({
        where: { id: message.migrationId, workerLeaseId: leaseId },
        data: {
          status: "failed",
          phase: "recovery",
          failurePhase: "commit",
          failureCode: "plan_conflict",
          error: outcome.message || "The approved plan no longer matches.",
          workerLeaseId: null,
          workerLeaseExpiresAt: null,
          completedAt: new Date(),
        },
      });
      return { accepted: true, status: "failed", message: outcome.message };
    }
    if (outcome.status === "completed" || outcome.status === "completed_with_issues") {
      await finalizeMigrationActivation(job.userId, message.migrationId, outcome);
    }
    await prisma.importJob.updateMany({
      where: { id: message.migrationId, workerLeaseId: leaseId },
      data: {
        workerLeaseId: null,
        workerLeaseExpiresAt: null,
        lastHeartbeatAt: new Date(),
        failurePhase: outcome.status === "failed" ? "commit" : null,
        failureCode: outcome.status === "failed" ? "batch_failed" : null,
      },
    });
    if (outcome.status === "failed") throw new CommitBatchError(outcome.message || "Commit failed.");
    return { accepted: true, status: outcome.status };
  } catch (error) {
    await prisma.importJob.updateMany({
      where: { id: message.migrationId, workerLeaseId: leaseId },
      data: { workerLeaseId: null, workerLeaseExpiresAt: null, failurePhase: "commit", failureCode: safeCode(error) },
    });
    throw error;
  }
}

export async function processMigrationWork(message: MigrationWorkMessage): Promise<MigrationWorkOutcome> {
  const currentEnvironment = (process.env.APP_ENV || "local").toLowerCase();
  if (message.environment !== currentEnvironment && currentEnvironment !== "local") {
    return { accepted: false, status: "wrong_environment" };
  }
  const job = await prisma.importJob.findUnique({ where: { id: message.migrationId }, select: { status: true, inputRevision: true } });
  if (!job) return { accepted: true, status: "missing" };
  if (["completed", "completed_with_issues", "abandoned"].includes(job.status)) return { accepted: true, status: job.status };
  if (job.inputRevision !== message.inputRevision) return { accepted: true, status: "superseded" };

  const leaseId = await claim(message);
  if (!leaseId) return { accepted: true, status: "already_claimed" };
  return message.operation === "commit" ? runCommit(message, leaseId) : runAnalysis(message, leaseId);
}
