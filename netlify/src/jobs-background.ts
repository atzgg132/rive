import { prisma } from "@/utils/db";
import { enqueueMigrationWork } from "@/utils/migration/queue";

type Event = { httpMethod: string; headers: Record<string, string | undefined>; body: string | null };

export function scheduledPaths(time: Date): string[] {
  const minute = time.getUTCMinutes();
  const paths = ["/api/cron/email-outbox"];
  if (minute % 5 === 0) paths.push("/api/calendar/sync-outbox");
  if (minute % 15 === 0) paths.push("/api/contracts/maintenance", "/api/cron/funnel-quality");
  if (minute === 0) {
    paths.push("/api/cron/portfolio-assets", "/api/cron/weekly-summary");
    if (time.getUTCHours() % 6 === 0) paths.push("/api/calendar/maintenance");
  }
  return paths;
}

async function recoverImports() {
  const now = new Date();
  // ImportJob is the durable queue. Existing leases and commit ledgers make
  // duplicate deliveries safe, including a function that dies mid-import.
  const jobs = await prisma.importJob.findMany({
    where: {
      engineVersion: 2,
      attemptCount: { lt: 5 },
      AND: [
        { OR: [{ workerLeaseExpiresAt: null }, { workerLeaseExpiresAt: { lt: now } }] },
        { OR: [
          { status: { in: ["queued_analysis", "queued_commit", "profiling", "mapping", "committing"] } },
          { status: "failed", failureCode: { in: ["worker_failed", "batch_failed"] }, failurePhase: { in: ["analysis", "commit"] } },
        ] },
      ],
    },
    select: { id: true, inputRevision: true, status: true, failurePhase: true, planHash: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  for (const job of jobs) {
    const commit = ["queued_commit", "committing"].includes(job.status) || (job.status === "failed" && job.failurePhase === "commit");
    await enqueueMigrationWork({ migrationId: job.id, inputRevision: job.inputRevision, operation: commit ? "commit" : "reanalyze", ...(commit && job.planHash ? { planHash: job.planHash } : {}) });
  }
}

export async function handler(event: Event) {
  if (event.httpMethod !== "POST" || !process.env.CRON_SECRET || event.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return { statusCode: 401, body: "Unauthorized" };
  }
  if (process.env.NETLIFY_SCHEDULES_ENABLED !== "true") return { statusCode: 200, body: "Disabled" };
  const input = JSON.parse(event.body || "{}");
  const time = new Date(input.scheduledAt);
  if (!Number.isFinite(time.getTime())) return { statusCode: 400, body: "Invalid schedule" };
  const baseUrl = process.env.NETLIFY_SITE_URL;
  if (!baseUrl) throw new Error("Netlify origin is missing.");
  const origin = new URL(baseUrl);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".netlify.app")) throw new Error("Invalid Netlify origin.");
  const failures = [];
  for (const path of scheduledPaths(time)) {
    try {
      const response = await fetch(new URL(path, origin), {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}`, "Content-Type": "application/json", "User-Agent": "rive-netlify-job-runner/1.0" },
        body: "{}",
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`Job returned ${response.status}`);
      console.info(JSON.stringify({ event: "scheduled_job_completed", path, status: response.status }));
    } catch {
      failures.push(path);
    }
  }
  try { await recoverImports(); } catch { failures.push("migration_recovery"); }
  if (failures.length) throw new Error(`Scheduled jobs failed: ${failures.join(", ")}`);
  return { statusCode: 200, body: "Processed" };
}
