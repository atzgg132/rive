/**
 * D6 (START-02): milestone optional; project deadline and milestone date
 * independent and both optional; saved state replays deterministically.
 *
 * Exercises the REAL engagement service (`src/utils/engagements.ts`) against
 * the REAL isolated Postgres database: creation, reload-equivalent replay,
 * and conflicting reuse under one flow ID.
 *
 * Run: see tests/persistence/w04-invoice-idempotency.test.mjs header.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  EngagementInputError,
  createClientEngagement,
  engagementFlowAvailable,
  parseStartEngagementInput,
} from "../../src/utils/engagements.ts";
import { prisma } from "../../src/utils/db.ts";

const DATABASE_URL = process.env.DATABASE_URL || "";
assert.match(DATABASE_URL, /rive_w04/, "persistence tests must target the isolated rive_w04 database");
assert.equal(engagementFlowAvailable(), true, "engagement flow must be enabled for this test");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

let ownerSeq = 0;

async function createOwner() {
  ownerSeq += 1;
  return prisma.user.create({
    data: {
      email: `w04-eng-${stamp}-o${ownerSeq}@example.invalid`,
      passwordHash: "scrypt:w04-test-fixture",
      name: `W04 Eng ${stamp}`,
      currency: "USD",
    },
  });
}

function input(flowId, overrides = {}) {
  return parseStartEngagementInput({
    flowId,
    entryPoint: "workspace",
    sessionId: null,
    client: { mode: "new", name: `W04 Eng Client ${flowId}`, email: null },
    project: { title: `W04 Eng Project ${flowId}`, scope: null },
    milestone: null,
    scopeMode: "project",
    ...overrides,
  });
}

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

test("client work saves with no dates and replays under the same flow ID", async () => {
  const owner = await createOwner();
  const flowId = `w04-eng-nodates-${stamp}`;
  const first = await createClientEngagement(owner.id, input(flowId));
  assert.equal(first.replayed, false);
  assert.ok(first.records.clientId);
  assert.ok(first.records.projectId);
  assert.equal(first.records.milestoneId, undefined);

  const project = await prisma.project.findUnique({
    where: { id: first.records.projectId },
    include: { milestones: true },
  });
  assert.equal(project?.dueDate, null);
  assert.equal(project?.milestones.length, 0);

  // Reload-equivalent retry: same flow ID, same intent → same records.
  const replay = await createClientEngagement(owner.id, input(flowId));
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.records, first.records);
});

test("project deadline and milestone date persist independently", async () => {
  const owner = await createOwner();
  const flowId = `w04-eng-dates-${stamp}`;
  const result = await createClientEngagement(
    owner.id,
    input(flowId, {
      project: { title: `W04 Eng Dated ${stamp}`, scope: null, deadline: "2026-11-01" },
      milestone: { title: "Design approval", dueDate: "2026-09-15" },
    }),
  );
  assert.ok(result.records.milestoneId);

  const project = await prisma.project.findUnique({
    where: { id: result.records.projectId },
    include: { milestones: true },
  });
  assert.equal(dateOnly(project?.dueDate), "2026-11-01");
  assert.equal(project?.milestones.length, 1);
  assert.equal(dateOnly(project?.milestones[0]?.dueDate), "2026-09-15");
});

test("an undated milestone saves without a project deadline", async () => {
  const owner = await createOwner();
  const flowId = `w04-eng-undated-${stamp}`;
  const result = await createClientEngagement(
    owner.id,
    input(flowId, { milestone: { title: "Kickoff" } }),
  );
  const milestone = await prisma.milestone.findUnique({ where: { id: result.records.milestoneId } });
  assert.equal(milestone?.title, "Kickoff");
  assert.equal(milestone?.dueDate, null);
  const project = await prisma.project.findUnique({ where: { id: result.records.projectId } });
  assert.equal(project?.dueDate, null);
});

test("reusing a flow ID with different options is rejected", async () => {
  const owner = await createOwner();
  const flowId = `w04-eng-conflict-${stamp}`;
  await createClientEngagement(owner.id, input(flowId));
  await assert.rejects(
    () => createClientEngagement(owner.id, input(flowId, { milestone: { title: "Late addition" } })),
    (error) => error instanceof EngagementInputError && error.code === "idempotency_conflict",
  );
});
