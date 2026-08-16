import { checkServerIdentity } from "node:tls";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

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
const environment = (process.env.APP_ENV || process.env.NODE_ENV || "local").toLowerCase();

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
const rows = [];

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
  rows.push({
    userId: input.userId,
    eventName: input.eventName,
    eventVersion: 1,
    schemaVersion: 1,
    occurredAt: input.occurredAt,
    environment,
    module: input.module || null,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    dataOrigin: input.dataOrigin || null,
    source: "backfill",
    dedupeKey: input.dedupeKey,
    properties: input.properties || undefined,
  });
}

async function buildCandidates() {
  const users = await prisma.user.findMany({
    where: { accountType: { notIn: ["internal", "test", "demo", "e2e", "synthetic"] } },
    select: { id: true, accountType: true, createdAt: true, updatedAt: true, emailVerifiedAt: true, onboardingStatus: true, onboardingData: true },
  });
  const customerIds = users.map((user) => user.id);
  for (const user of users) {
    add({ userId: user.id, eventName: "signup_completed", module: "auth", occurredAt: user.createdAt, dedupeKey: `signup_completed:${user.id}`, properties: { accountType: user.accountType, backfilled: true } });
    if (user.emailVerifiedAt) add({ userId: user.id, eventName: "email_verified", module: "auth", occurredAt: user.emailVerifiedAt, dedupeKey: `email_verified:${user.id}`, properties: { backfilled: true } });
    if (["complete", "skipped"].includes(user.onboardingStatus)) add({ userId: user.id, eventName: "onboarding_completed", module: "onboarding", occurredAt: user.updatedAt, dedupeKey: `onboarding_completed:${user.id}`, properties: { backfilled: true } });
  }

  const [clients, projects, invoices, expenses, calendarEvents, imports, portfolios, activationAudit] = await Promise.all([
    prisma.client.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, createdAt: true, dataOrigin: true } }),
    prisma.project.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, createdAt: true, dataOrigin: true } }),
    prisma.invoice.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, createdAt: true, dataOrigin: true } }),
    prisma.expense.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, createdAt: true, dataOrigin: true } }),
    prisma.calendarEvent.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) }, deletedAt: null }, select: { id: true, userId: true, createdAt: true, dataOrigin: true } }),
    prisma.importJob.findMany({ where: { userId: { in: customerIds }, status: { in: ["completed", "completed_with_issues"] } }, select: { id: true, userId: true, completedAt: true, createdAt: true, totalRows: true, createdRecords: true, unresolvedCount: true } }),
    prisma.portfolio.findMany({ where: { userId: { in: customerIds }, status: "published", publishedAt: { not: null } }, select: { id: true, userId: true, publishedAt: true, content: true } }),
    prisma.auditEvent.findMany({ where: { userId: { in: customerIds }, OR: [{ action: { startsWith: "activation." } }, { action: { startsWith: "guidance." } }] }, select: { id: true, userId: true, action: true, createdAt: true, metadata: true } }),
  ]);

  for (const row of clients) add({ userId: row.userId, eventName: "client_created", module: "clients", entityType: "client", entityId: row.id, dataOrigin: row.dataOrigin, occurredAt: row.createdAt, dedupeKey: `backfill:client_created:${row.id}`, properties: { backfilled: true } });
  for (const row of projects) add({ userId: row.userId, eventName: "project_created", module: "projects", entityType: "project", entityId: row.id, dataOrigin: row.dataOrigin, occurredAt: row.createdAt, dedupeKey: `backfill:project_created:${row.id}`, properties: { backfilled: true } });
  for (const row of invoices) add({ userId: row.userId, eventName: "invoice_created", module: "invoices", entityType: "invoice", entityId: row.id, dataOrigin: row.dataOrigin, occurredAt: row.createdAt, dedupeKey: `backfill:invoice_created:${row.id}`, properties: { backfilled: true } });
  for (const row of expenses) add({ userId: row.userId, eventName: "expense_created", module: "expenses", entityType: "expense", entityId: row.id, dataOrigin: row.dataOrigin, occurredAt: row.createdAt, dedupeKey: `backfill:expense_created:${row.id}`, properties: { backfilled: true } });
  for (const row of calendarEvents) add({ userId: row.userId, eventName: "calendar_used", module: "calendar", entityType: "calendar_event", entityId: row.id, dataOrigin: row.dataOrigin, occurredAt: row.createdAt, dedupeKey: `backfill:calendar_used:${row.id}`, properties: { backfilled: true } });
  for (const row of imports) add({ userId: row.userId, eventName: "import_committed", module: "migration", entityType: "migration", entityId: row.id, dataOrigin: "imported", occurredAt: row.completedAt || row.createdAt, dedupeKey: `backfill:import_committed:${row.id}`, properties: { totalRows: row.totalRows, createdRecords: row.createdRecords, unresolvedCount: row.unresolvedCount, backfilled: true } });
  const realProjectIdsByUser = new Map();
  for (const row of projects) {
    if (!realProjectIdsByUser.has(row.userId)) realProjectIdsByUser.set(row.userId, new Set());
    realProjectIdsByUser.get(row.userId).add(`project-${row.id}`);
  }
  for (const row of portfolios) {
    if (!portfolioHasActivationSignals(row.content, realProjectIdsByUser.get(row.userId) || new Set())) continue;
    add({ userId: row.userId, eventName: "portfolio_published", module: "portfolio", entityType: "portfolio", entityId: row.id, dataOrigin: "user", occurredAt: row.publishedAt, dedupeKey: `backfill:portfolio_published:${row.id}`, properties: { backfilled: true } });
  }
  for (const row of activationAudit) {
    if (!ACTIVATION_EVENT_NAMES.has(row.action)) continue;
    add({ userId: row.userId, eventName: row.action, module: row.action.startsWith("guidance.") ? "guidance" : "activation", occurredAt: row.createdAt, dedupeKey: `activation:${row.userId}:${row.action}`, properties: { ...(isRecord(row.metadata) ? row.metadata : {}), backfilled: true } });
  }
}

try {
  await buildCandidates();
  const unique = new Map(rows.map((row) => [row.dedupeKey, row]));
  const candidates = Array.from(unique.values());
  console.log(`[product-event-backfill] mode=${apply ? "apply" : "dry-run"} candidates=${candidates.length} environment=${environment}`);
  if (apply) {
    let applied = 0;
    for (let index = 0; index < candidates.length; index += 100) {
      const batch = candidates.slice(index, index + 100);
      await Promise.all(batch.map((data) => prisma.productEvent.upsert({ where: { dedupeKey: data.dedupeKey }, update: {}, create: data })));
      applied += batch.length;
      if (applied % 1_000 === 0 || applied === candidates.length) console.log(`[product-event-backfill] processed=${applied}/${candidates.length}`);
    }
  } else {
    console.log("[product-event-backfill] no writes performed; rerun with --apply after reviewing the candidate count.");
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
