import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "../helpers/prisma-mock.mjs";

/**
 * Crash-resume integration test for `commitMigration`.
 *
 * Drives the real commit engine against an in-memory Prisma mock, so this runs
 * in the no-DB `test:domain` suite while still exercising the exact
 * `STALE_COMMIT_MS` resume path end to end: a first attempt dies mid-batch,
 * the migration is left `committing` with a stale `startedAt`, and a second
 * call must resume from the ledger rather than re-running batch 1.
 *
 * Run with the loader so `@/utils/db` resolves to the shared mock:
 *   node --experimental-strip-types --import ./tests/helpers/module-loader.mjs \
 *        --test tests/domain/migration-crash-resume.test.mjs
 *
 * The mock deliberately has no delete capability — consistent with the
 * production no-delete policy. Nothing here touches a real database.
 */

const STALE_COMMIT_MS = 5 * 60 * 1000;
const JOB_ID = "job-crash-resume-1";
const USER_ID = "user-crash-resume-1";
const PLAN_HASH = "a".repeat(64);

/**
 * Number of client records. With `commitBatchSize: 200` from config, this
 * makes batch 0 hold 200 client creations and batch 1 hold the projects +
 * invoices — so the injected crash lands in the second batch, after clients
 * are already applied.
 */
const CLIENT_COUNT = 200;
const PROJECT_COUNT = 5;
const INVOICE_COUNT = 5;

const commitMigration = (await import("../../src/utils/migration/commit.ts")).commitMigration;

function rec(entity, sourceKey, groupKey, name, status, rowNum, extra = {}) {
  return {
    id: `rec-${sourceKey}`,
    importJobId: JOB_ID,
    importFileId: null,
    entity,
    sourceRow: rowNum,
    sourceKey,
    externalId: null,
    raw: {},
    normalized: {
      name: name || null,
      email: null,
      phone: null,
      company: null,
      website: null,
      address: null,
      notes: null,
      status,
      title: name || null,
      description: null,
      priority: "medium",
      budget: null,
      currency: "INR",
      startDate: null,
      dueDate: null,
      invoiceNumber: name || null,
      subtotal: 100,
      taxRate: 0,
      taxAmount: 0,
      total: 100,
      issueDate: "2026-04-03",
      paidDate: null,
      category: "other",
      amount: 50,
      date: "2026-04-03",
      receiptUrl: null,
      isBillable: false,
      isReimbursed: false,
    },
    fieldMappings: {},
    confidence: 1,
    warnings: [],
    errors: [],
    relationshipCandidates: [],
    resolvedRelationships: {},
    duplicateCandidates: [],
    groupKey,
    status: "ready",
    action: "create",
    targetType: null,
    targetId: null,
    ...extra,
  };
}

function buildPlan() {
  const operations = [];
  for (let i = 0; i < CLIENT_COUNT; i += 1) {
    operations.push({
      operationKey: `create:clients-c${i}`,
      sequence: i,
      action: "create",
      entity: "clients",
      sourceKey: `clients-c${i}`,
      label: `Client ${i}`,
      existingId: null,
      reason: "test",
      payloadHash: `payload-hash-${i}`,
    });
  }
  for (let i = 0; i < PROJECT_COUNT; i += 1) {
    operations.push({
      operationKey: `create:projects-p${i}`,
      sequence: CLIENT_COUNT + i,
      action: "create",
      entity: "projects",
      sourceKey: `projects-p${i}`,
      label: `Project ${i}`,
      existingId: null,
      reason: "test",
      payloadHash: `payload-hash-p${i}`,
    });
  }
  for (let i = 0; i < INVOICE_COUNT; i += 1) {
    operations.push({
      operationKey: `create:invoices-i${i}`,
      sequence: CLIENT_COUNT + PROJECT_COUNT + i,
      action: "create",
      entity: "invoices",
      sourceKey: `invoices-i${i}`,
      label: `Invoice ${i}`,
      existingId: null,
      reason: "test",
      payloadHash: `payload-hash-i${i}`,
    });
  }
  return {
    engineVersion: 2,
    planHash: PLAN_HASH,
    planVersion: 1,
    createdAt: new Date().toISOString(),
    counts: {
      clients: { create: CLIENT_COUNT, link: 0, skip: 0, review: 0 },
      projects: { create: PROJECT_COUNT, link: 0, skip: 0, review: 0 },
      invoices: { create: INVOICE_COUNT, link: 0, skip: 0, review: 0 },
      expenses: { create: 0, link: 0, skip: 0, review: 0 },
    },
    totals: { create: CLIENT_COUNT + PROJECT_COUNT + INVOICE_COUNT, link: 0, skip: 0, review: 0, error: 0 },
    operations,
    reviewItems: [],
    blocked: [],
    metrics: { autoMappingRate: 1, relationshipResolutionRate: 1, duplicateRate: 0, warningCount: 0, errorCount: 0 },
  };
}

function seed(db) {
  db.importJob.push({
    id: JOB_ID,
    userId: USER_ID,
    status: "ready",
    phase: "review",
    engineVersion: 2,
    planHash: PLAN_HASH,
    plan: buildPlan(),
    defaultCurrency: "INR",
    createdAt: new Date(),
    startedAt: null,
    error: null,
  });

  const records = [];
  for (let i = 0; i < CLIENT_COUNT; i += 1) {
    records.push(rec("clients", `clients-c${i}`, `g${i}`, `Client ${i}`, "active", 1 + i));
  }
  for (let i = 0; i < PROJECT_COUNT; i += 1) {
    records.push(rec("projects", `projects-p${i}`, null, `Project ${i}`, "active", CLIENT_COUNT + 1 + i));
  }
  // Invoices reference client group g0 and project p0 — their relationship
  // resolution survives a resume because commit seeds the resolution map from
  // already-applied ledger entries.
  for (let i = 0; i < INVOICE_COUNT; i += 1) {
    records.push(
      rec("invoices", `invoices-i${i}`, null, `Invoice ${i}`, "draft", CLIENT_COUNT + PROJECT_COUNT + 1 + i, {
        resolvedRelationships: {
          clientId: { groupKey: "g0", existingId: null },
          projectId: { groupKey: "projects-p0", existingId: null },
        },
      }),
    );
  }
  db.migrationRecord.push(...records);
}

test("a commit that crashes mid-batch can be resumed without duplicating any record", async () => {
  // Each test resets the shared mock's tables; the mock instance itself is
  // module-level so the server module under test and this test share it.
  prisma.__reset();
  prisma.__db.user = [{ id: USER_ID, currency: "INR" }];
  seed(prisma.__db);

  // --- Attempt 1: dies in the second batch (simulated crash) ---
  // Batch 0 (the 200 client creations) succeeds; the second $transaction call
  // — batch 1 (projects + invoices) — throws, exactly like a mid-commit crash.
  prisma.__armFailure(1);
  const first = await commitMigration(USER_ID, JOB_ID, PLAN_HASH);

  assert.equal(first.status, "failed");
  assert.equal(first.created.clients, CLIENT_COUNT, "batch 1 created all clients");
  assert.equal(first.created.projects, 0, "the second batch never ran");
  assert.equal(first.created.invoices, 0, "the second batch never ran");
  assert.match(first.message, /records were imported before this stopped/i);
  assert.ok(first.failedOperation, "the failing operation is reported");

  const appliedOps = prisma.__db.migrationOperation.filter((o) => o.status === "applied");
  assert.equal(appliedOps.length, CLIENT_COUNT, "exactly batch 1's operations are applied");

  // The crash left the migration claiming the commit.
  const jobAfterCrash = prisma.__db.importJob[0];
  assert.equal(jobAfterCrash.status, "failed", "crash marks the job failed");
  assert.ok(jobAfterCrash.startedAt, "startedAt is set from the first attempt");

  // --- Attempt 2: resume. Back-date startedAt past the staleness window so
  // the claim check lets a second attempt in, exactly like a real restart. ---
  prisma.__db.importJob[0].startedAt = new Date(Date.now() - STALE_COMMIT_MS - 60_000);

  const second = await commitMigration(USER_ID, JOB_ID, PLAN_HASH);

  assert.equal(second.status, "completed", "the resumed commit completes");
  assert.deepEqual(
    second.created,
    { clients: CLIENT_COUNT, projects: PROJECT_COUNT, invoices: INVOICE_COUNT, expenses: 0 },
    "the resumed result reports the complete import, including earlier applied batches",
  );
  assert.equal(second.failed, 0);

  // --- No duplicates anywhere ---
  assert.equal(prisma.__db.client.length, CLIENT_COUNT, "clients exist exactly once");
  assert.equal(prisma.__db.project.length, PROJECT_COUNT, "projects exist exactly once");
  assert.equal(prisma.__db.invoice.length, INVOICE_COUNT, "invoices exist exactly once");

  const clientNames = new Set(prisma.__db.client.map((c) => c.name));
  assert.equal(clientNames.size, CLIENT_COUNT, "client names are unique");

  // --- clientIdByGroup resolution: the invoices attached to the client that
  // the resume seeded from batch-1's applied ledger entries ---
  const clientByGroup = new Map(
    prisma.__db.migrationOperation
      .filter((o) => o.entity === "clients" && o.status === "applied")
      .map((o) => [
        prisma.__db.migrationRecord.find((r) => r.sourceKey === o.sourceKey)?.groupKey,
        o.targetId,
      ]),
  );
  const groupClientId = clientByGroup.get("g0");
  assert.ok(groupClientId, "the client group resolved to a real id");

  for (const invoice of prisma.__db.invoice) {
    assert.equal(invoice.clientId, groupClientId, "resumed commit attaches invoices to the batch-1 client");
    assert.ok(invoice.projectId, "invoice project relationship resolved");
  }

  // --- Every imported record is mapped exactly once ---
  const mappings = prisma.__db.importedRecord;
  assert.equal(mappings.length, CLIENT_COUNT + PROJECT_COUNT + INVOICE_COUNT, "one mapping per created record");
  assert.equal(
    new Set(mappings.map((m) => m.targetId)).size,
    CLIENT_COUNT + PROJECT_COUNT + INVOICE_COUNT,
    "every mapping points at a distinct record",
  );

  // --- Ledger is fully applied, nothing pending ---
  assert.equal(prisma.__db.migrationOperation.filter((o) => o.status === "pending").length, 0);
  assert.equal(
    prisma.__db.migrationOperation.filter((o) => o.status === "applied").length,
    CLIENT_COUNT + PROJECT_COUNT + INVOICE_COUNT,
  );
});
