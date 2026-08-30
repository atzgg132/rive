import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import { prisma } from "../src/utils/db.ts";
import { parseCsvText } from "../src/lib/migration/parse/csv.ts";
import { persistSources, analyzeMigration } from "../src/utils/migration/analyze.ts";
import { commitMigration } from "../src/utils/migration/commit.ts";

const runId = randomUUID();
const email = `migration-smoke-${runId}@example.invalid`;

function upload(fileName, csv) {
  const bytes = Buffer.from(csv, "utf8");
  const table = parseCsvText(csv, { fileName });
  return {
    fileName,
    mimeType: "text/csv",
    sizeBytes: bytes.byteLength,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    sourceId: `${createHash("sha256").update(bytes).digest("hex")}:${table.sheetName || "csv"}`,
    table,
  };
}

const sources = [
  upload("clients.csv", "client_name,email\nAcme Migration Smoke,owner@migration-smoke.example.invalid"),
  upload("projects.csv", "project_name,client,deadline,budget,status\nMigration Smoke Project,Acme Migration Smoke,2026-12-01,10000,in progress"),
  upload("invoices.csv", "invoice_no,customer,project,total,currency,issue_date,due_date,status\nSMOKE-001,Acme Migration Smoke,Migration Smoke Project,5000,INR,2026-08-01,2026-09-01,sent"),
  upload("expenses.csv", "merchant,amount,expense_date,category,project\nMigration Smoke Expense,250,2026-08-02,software,Migration Smoke Project"),
];

try {
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: "hosted-smoke-only",
      name: "Migration Hosted Smoke",
      plan: "free",
      accountType: "test",
      emailVerifiedAt: new Date(),
      onboardingStatus: "complete",
      onboardingStep: 5,
      timeZone: "UTC",
      currency: "INR",
    },
    select: { id: true },
  });
  const job = await prisma.importJob.create({
    data: {
      userId: user.id,
      engineVersion: 2,
      source: "hosted_smoke",
      sourceLabel: `migration smoke ${runId}`,
      status: "uploading",
      phase: "analysis",
      mode: "hosted_smoke",
      defaultCurrency: "INR",
    },
    select: { id: true },
  });
  await persistSources(job.id, sources);
  const analysis = await analyzeMigration(user.id, job.id, 0);
  assert.equal(analysis.state, "ready", "hosted fixture must produce a commit-ready plan");
  assert.equal(analysis.plan.blocked.length, 0);
  assert.equal(analysis.plan.reviewItems.length, 0);

  const outcome = await commitMigration(user.id, job.id, analysis.plan.planHash);
  assert.ok(["completed", "completed_with_issues"].includes(outcome.status));
  assert.deepEqual(outcome.created, { clients: 1, projects: 1, invoices: 1, expenses: 1 });

  const [client, project, invoice, expense] = await Promise.all([
    prisma.client.findFirst({ where: { userId: user.id } }),
    prisma.project.findFirst({ where: { userId: user.id } }),
    prisma.invoice.findFirst({ where: { userId: user.id } }),
    prisma.expense.findFirst({ where: { userId: user.id } }),
  ]);
  assert.ok(client && project && invoice && expense);
  assert.equal(project.clientId, client.id);
  assert.equal(invoice.clientId, client.id);
  assert.equal(invoice.projectId, project.id);
  assert.equal(expense.projectId, project.id);
  console.log(JSON.stringify({ success: true, runId, email, migrationId: job.id, retained: true }));
} catch (error) {
  console.error(`Migration hosted smoke failed for ${email}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
