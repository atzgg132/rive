import { checkServerIdentity } from "node:tls";
import { writeFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const BACKFILL_VERSION = 2;
const EVENT_SCHEMA_VERSION = 1;
const EVENT_VERSION = 1;
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const jsonOutput = args.includes("--json");
const databaseUrl = process.env.DATABASE_URL;
const rawEnvironment = (process.env.APP_ENV || process.env.NODE_ENV || "local").toLowerCase();
const environment = rawEnvironment === "production" ? "prod" : rawEnvironment;

function hasFlag(name) {
  return args.includes(name) || args.some((argument) => argument.startsWith(`${name}=`));
}

function flagValue(name) {
  const inline = args.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || null : null;
}

function positiveIntegerFlag(name) {
  const value = flagValue(name);
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

const maxCandidates = positiveIntegerFlag("--max-candidates");
const reportPath = flagValue("--report");

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!environment) throw new Error("APP_ENV or NODE_ENV must identify the target environment.");
if (apply && !hasFlag("--confirm-backfill") && !hasFlag("--confirm-production-backfill")) {
  throw new Error("Applying a backfill requires --confirm-backfill; dry-run is the default.");
}
if (apply && environment === "prod" && !hasFlag("--confirm-production-backfill")) {
  throw new Error("Production apply requires --confirm-production-backfill.");
}
if (apply && maxCandidates === null) {
  throw new Error("Applying a backfill requires an explicit --max-candidates bound.");
}

const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
const parsedConnectionString = new URL(databaseUrl);
for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsedConnectionString.searchParams.delete(parameter);
const pool = new Pool({
  connectionString: parsedConnectionString.toString(),
  ssl: process.env.DATABASE_SSL === "disable" || databaseUrl.includes("sslmode=disable")
    ? false
    : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true", ...(sslServerName ? { checkServerIdentity: (_hostname, certificate) => checkServerIdentity(sslServerName, certificate) } : {}) },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const REAL_DATA_ORIGINS = new Set(["user", "imported"]);
const ACTIVATION_EVENT_NAMES = new Set([
  "activation.registered",
  "activation.onboarding_started",
  "activation.profile_substantially_completed",
  "activation.portfolio_published",
  "activation.first_client_created",
  "activation.first_project_created",
  "activation.first_meaningful_workflow_completed",
  "guidance.started",
  "guidance.skipped",
  "guidance.completed",
  "guidance.replayed",
]);
const candidatesByDedupeKey = new Map();

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function portfolioHasActivationSignals(content, realProjectIds) {
  if (!isRecord(content) || typeof content.contactEmail !== "string" || !content.contactEmail.trim()) return false;
  if (!Array.isArray(content.projects)) return false;
  return content.projects.some((project) => isRecord(project)
    && typeof project.id === "string"
    && realProjectIds.has(project.id)
    && project.visibility !== "private"
    && typeof project.title === "string"
    && Boolean(project.title.trim()));
}

function add(input) {
  if (!input.userId || !input.eventName || !input.occurredAt || !input.dedupeKey) return;
  const candidate = {
    userId: input.userId,
    eventName: input.eventName,
    eventVersion: EVENT_VERSION,
    schemaVersion: EVENT_SCHEMA_VERSION,
    occurredAt: input.occurredAt,
    environment,
    module: input.module || null,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    dataOrigin: input.dataOrigin || null,
    source: "backfill",
    dedupeKey: input.dedupeKey,
    properties: { backfillVersion: BACKFILL_VERSION, ...(input.properties || {}) },
  };
  const previous = candidatesByDedupeKey.get(input.dedupeKey);
  // Audit tables can contain repeated milestone rows. Keep the earliest
  // occurrence so the backfill remains deterministic and idempotent.
  if (!previous || candidate.occurredAt < previous.occurredAt) candidatesByDedupeKey.set(input.dedupeKey, candidate);
}

async function buildCandidates() {
  const users = await prisma.user.findMany({
    where: { accountType: { notIn: ["internal", "test", "demo", "e2e", "synthetic"] } },
    select: { id: true, accountType: true, createdAt: true, updatedAt: true, emailVerifiedAt: true, onboardingStatus: true, onboardingData: true },
  });
  const customerIds = users.map((user) => user.id);
  for (const user of users) {
    add({ userId: user.id, eventName: "signup_completed", module: "auth", occurredAt: user.createdAt, dedupeKey: `signup_completed:${user.id}`, properties: { accountType: user.accountType } });
    if (user.emailVerifiedAt) add({ userId: user.id, eventName: "email_verified", module: "auth", occurredAt: user.emailVerifiedAt, dedupeKey: `email_verified:${user.id}` });
    if (["complete", "skipped"].includes(user.onboardingStatus)) add({ userId: user.id, eventName: "onboarding_completed", module: "onboarding", occurredAt: user.updatedAt, dedupeKey: `onboarding_completed:${user.id}` });
  }

  const [clients, projects, invoices, expenses, calendarEvents, imports, portfolios, activationAudit] = await Promise.all([
    prisma.client.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, createdAt: true, dataOrigin: true } }),
    prisma.project.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, createdAt: true, dataOrigin: true } }),
    prisma.invoice.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, createdAt: true, dataOrigin: true } }),
    prisma.expense.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, createdAt: true, dataOrigin: true } }),
    prisma.calendarEvent.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) }, deletedAt: null }, select: { id: true, userId: true, createdAt: true, dataOrigin: true } }),
    prisma.importJob.findMany({ where: { userId: { in: customerIds }, status: { in: ["completed", "completed_with_issues"] } }, select: { id: true, userId: true, completedAt: true, createdAt: true, totalRows: true, createdRecords: true, unresolvedCount: true, records: { select: { targetType: true } } } }),
    prisma.portfolio.findMany({ where: { userId: { in: customerIds }, status: "published", publishedAt: { not: null } }, select: { id: true, userId: true, publishedAt: true, content: true } }),
    prisma.auditEvent.findMany({ where: { userId: { in: customerIds }, OR: [{ action: { startsWith: "activation." } }, { action: { startsWith: "guidance." } }] }, select: { id: true, userId: true, action: true, createdAt: true, metadata: true } }),
  ]);

  for (const row of clients) add({ userId: row.userId, eventName: "client_created", module: "clients", entityType: "client", entityId: row.id, dataOrigin: row.dataOrigin, occurredAt: row.createdAt, dedupeKey: `backfill:client_created:${row.id}` });
  for (const row of projects) add({ userId: row.userId, eventName: "project_created", module: "projects", entityType: "project", entityId: row.id, dataOrigin: row.dataOrigin, occurredAt: row.createdAt, dedupeKey: `backfill:project_created:${row.id}` });
  for (const row of invoices) add({ userId: row.userId, eventName: "invoice_created", module: "invoices", entityType: "invoice", entityId: row.id, dataOrigin: row.dataOrigin, occurredAt: row.createdAt, dedupeKey: `backfill:invoice_created:${row.id}` });
  for (const row of expenses) add({ userId: row.userId, eventName: "expense_created", module: "expenses", entityType: "expense", entityId: row.id, dataOrigin: row.dataOrigin, occurredAt: row.createdAt, dedupeKey: `backfill:expense_created:${row.id}` });
  for (const row of calendarEvents) add({ userId: row.userId, eventName: "calendar_used", module: "calendar", entityType: "calendar_event", entityId: row.id, dataOrigin: row.dataOrigin, occurredAt: row.createdAt, dedupeKey: `backfill:calendar_used:${row.id}` });
  for (const row of imports) {
    const targetTypes = new Set(row.records.map((record) => record.targetType).filter(Boolean));
    if (Number(row.createdRecords || 0) <= 0 || Number(row.unresolvedCount || 0) !== 0 || targetTypes.size < 2) continue;
    add({ userId: row.userId, eventName: "import_committed", module: "migration", entityType: "migration", entityId: row.id, dataOrigin: "imported", occurredAt: row.completedAt || row.createdAt, dedupeKey: `backfill:import_committed:${row.id}`, properties: { totalRows: row.totalRows, createdRecords: row.createdRecords, unresolvedCount: row.unresolvedCount, targetTypes: Array.from(targetTypes) } });
  }

  const realProjectIdsByUser = new Map();
  for (const row of projects) {
    if (!realProjectIdsByUser.has(row.userId)) realProjectIdsByUser.set(row.userId, new Set());
    realProjectIdsByUser.get(row.userId).add(`project-${row.id}`);
  }
  for (const row of portfolios) {
    if (!portfolioHasActivationSignals(row.content, realProjectIdsByUser.get(row.userId) || new Set())) continue;
    add({ userId: row.userId, eventName: "portfolio_published", module: "portfolio", entityType: "portfolio", entityId: row.id, dataOrigin: "user", occurredAt: row.publishedAt, dedupeKey: `backfill:portfolio_published:${row.id}` });
  }
  for (const row of activationAudit) {
    if (!ACTIVATION_EVENT_NAMES.has(row.action)) continue;
    add({ userId: row.userId, eventName: row.action, module: row.action.startsWith("guidance.") ? "guidance" : "activation", occurredAt: row.createdAt, dedupeKey: `activation:${row.userId}:${row.action}`, properties: { ...(isRecord(row.metadata) ? row.metadata : {}) } });
  }
  return users.length;
}

async function countExisting(candidates) {
  if (!candidates.length) return 0;
  let existing = 0;
  for (let index = 0; index < candidates.length; index += 500) {
    const keys = candidates.slice(index, index + 500).map((row) => row.dedupeKey);
    existing += await prisma.productEvent.count({ where: { dedupeKey: { in: keys } } });
  }
  return existing;
}

function makeReport(candidates, existingCount, usersCount) {
  const countsByEvent = {};
  const userIds = new Set();
  let earliest = null;
  let latest = null;
  for (const candidate of candidates) {
    countsByEvent[candidate.eventName] = (countsByEvent[candidate.eventName] || 0) + 1;
    userIds.add(candidate.userId);
    if (!earliest || candidate.occurredAt < earliest) earliest = candidate.occurredAt;
    if (!latest || candidate.occurredAt > latest) latest = candidate.occurredAt;
  }
  return {
    reportVersion: 1,
    backfillVersion: BACKFILL_VERSION,
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    environment,
    usersScanned: usersCount,
    candidateCount: candidates.length,
    existingCount,
    newCandidateCount: Math.max(0, candidates.length - existingCount),
    userCount: userIds.size,
    dateRange: { earliest: earliest?.toISOString() || null, latest: latest?.toISOString() || null },
    countsByEvent,
    maxCandidates,
    appliedCount: 0,
    status: apply ? "ready-to-apply" : "dry-run",
  };
}

async function applyCandidates(candidates, report) {
  let applied = 0;
  for (let index = 0; index < candidates.length; index += 100) {
    const batch = candidates.slice(index, index + 100);
    await prisma.$transaction(batch.map((data) => prisma.productEvent.upsert({ where: { dedupeKey: data.dedupeKey }, update: {}, create: data })));
    applied += batch.length;
    report.appliedCount = applied;
    if (applied % 1_000 === 0 || applied === candidates.length) console.error(`[product-event-backfill] processed=${applied}/${candidates.length}`);
  }
  report.status = "applied";
}

async function saveReport(report) {
  if (!reportPath) return;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error(`[product-event-backfill] report=${reportPath}`);
}

let report = null;
try {
  const usersCount = await buildCandidates();
  const candidates = Array.from(candidatesByDedupeKey.values()).sort((a, b) => a.occurredAt - b.occurredAt || a.dedupeKey.localeCompare(b.dedupeKey));
  if (maxCandidates !== null && candidates.length > maxCandidates) throw new Error(`Candidate count ${candidates.length} exceeds --max-candidates=${maxCandidates}.`);
  const existingCount = await countExisting(candidates);
  report = makeReport(candidates, existingCount, usersCount);
  console.error(`[product-event-backfill] mode=${report.mode} candidates=${report.candidateCount} existing=${report.existingCount} new=${report.newCandidateCount} environment=${environment}`);
  if (apply) await applyCandidates(candidates, report);
  else console.error("[product-event-backfill] no writes performed; review the report, then rerun with --apply --confirm-backfill and an explicit --max-candidates bound.");
  await saveReport(report);
  if (jsonOutput) console.log(JSON.stringify(report));
} catch (error) {
  console.error(`[product-event-backfill] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
