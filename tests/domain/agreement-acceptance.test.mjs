import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  acceptedWorkSetupBillingPark,
  persistAcceptedAgreementWorkSetup,
  WorkSetupError,
} from "../../src/utils/projectGeneration.ts";

const contractSignRoute = await readFile(
  new URL("../../src/app/api/public/contracts/sign/[token]/route.ts", import.meta.url),
  "utf8",
);
const startSigningRoute = await readFile(
  new URL("../../src/app/api/workflow/contracts/[id]/start-signing/route.ts", import.meta.url),
  "utf8",
);
const finalizeRoute = await readFile(
  new URL("../../src/app/api/workflow/contracts/[id]/finalize/route.ts", import.meta.url),
  "utf8",
);
const projectGenerationSource = await readFile(
  new URL("../../src/utils/projectGeneration.ts", import.meta.url),
  "utf8",
);

function createWorkSetupClient({
  contract = null,
  generations = [],
  occurrences = [],
  failGenerationCreate = false,
} = {}) {
  const state = {
    contract,
    generations: generations.map((row) => ({ ...row })),
    occurrences: occurrences.map((row) => ({ ...row })),
    planItems: (contract?.paymentPlanItems || []).map((item) => ({ ...item })),
  };

  return {
    state,
    client: {
      contract: {
        async findFirst() {
          if (!state.contract) return null;
          return {
            ...state.contract,
            paymentPlanItems: state.planItems.map((item) => ({
              id: item.id,
              triggerType: item.triggerType,
              triggerDate: item.triggerDate,
            })),
          };
        },
      },
      projectGenerationRecord: {
        async findFirst() {
          return state.generations.at(-1) || null;
        },
        async create({ data }) {
          if (failGenerationCreate) {
            const error = new Error("Unique constraint failed");
            error.code = "P2002";
            throw error;
          }
          const created = { id: data.id || `generation-${state.generations.length + 1}`, ...data };
          state.generations.push(created);
          return created;
        },
      },
      contractBillingOccurrence: {
        async findMany() {
          return state.occurrences.map((row) => ({ paymentPlanItemId: row.paymentPlanItemId, status: row.status }));
        },
        async createMany({ data, skipDuplicates }) {
          let count = 0;
          for (const row of data) {
            const exists = state.occurrences.some((existing) => existing.paymentPlanItemId === row.paymentPlanItemId);
            if (exists) {
              if (!skipDuplicates) {
                const error = new Error("Unique constraint failed");
                error.code = "P2002";
                throw error;
              }
              continue;
            }
            state.occurrences.push({ ...row });
            count += 1;
          }
          return { count };
        },
      },
      contractPaymentPlanItem: {
        async updateMany({ where, data }) {
          let count = 0;
          for (const item of state.planItems) {
            if (where.status && item.status !== where.status) continue;
            Object.assign(item, data);
            count += 1;
          }
          return { count };
        },
      },
    },
  };
}

function issueActiveSignLinks(existing, signerIds, { revokeFirst }) {
  const now = new Date();
  const next = existing.map((link) => (
    revokeFirst && link.type === "sign" && link.revokedAt == null && signerIds.includes(link.signerId)
      ? { ...link, revokedAt: now }
      : { ...link }
  ));
  for (const signerId of signerIds) {
    next.push({ id: `new-${signerId}`, signerId, type: "sign", revokedAt: null });
  }
  const activeSignerIds = next
    .filter((link) => link.type === "sign" && link.revokedAt == null)
    .map((link) => link.signerId);
  if (new Set(activeSignerIds).size !== activeSignerIds.length) {
    const error = new Error("Unique constraint failed on contract_review_links_one_active_signer_idx");
    error.code = "P2002";
    throw error;
  }
  return next;
}

test("completing dual-party acceptance commits without generation or billing-park writes in that transaction", () => {
  assert.match(contractSignRoute, /completion = await prisma\.\$transaction\(async \(tx\) => \{/);
  assert.match(contractSignRoute, /from: "signing", to: "executed"/);
  assert.match(contractSignRoute, /eventType: "contract_executed"/);
  assert.match(contractSignRoute, /enqueueEmail\(buildContractExecutedEmail\([\s\S]*?\), tx\)/);
  assert.doesNotMatch(contractSignRoute, /tx\.projectGenerationRecord/);
  assert.doesNotMatch(contractSignRoute, /tx\.contractBillingOccurrence/);
  assert.doesNotMatch(contractSignRoute, /tx\.contractPaymentPlanItem/);
});

test("work-setup persistence after accept is best-effort and cannot fail the recorded acceptance HTTP success", () => {
  const afterTransaction = contractSignRoute.split(/completion = await prisma\.\$transaction\(async \(tx\) => \{[\s\S]*?\n      \}\);/)[1];
  assert.match(afterTransaction, /if \(completion\.completed\) \{[\s\S]*ensureAcceptedAgreementWorkSetup\(prisma,[\s\S]*?\.catch\(/);
  assert.match(afterTransaction, /return NextResponse\.json\(\{ success: true/);
  const ensureBlock = afterTransaction.match(/await ensureAcceptedAgreementWorkSetup\(prisma,[\s\S]*?\.catch\([\s\S]*?\}\);/)[0];
  assert.match(ensureBlock, /\.catch\(/);
  assert.doesNotMatch(ensureBlock, /throw /);
});

test("work setup for an executed Agreement without a generation row backfills instead of 404ing first", () => {
  assert.match(projectGenerationSource, /export async function saveWorkSetupPreview[\s\S]*?requireOwnedProjectGeneration/);
  assert.match(projectGenerationSource, /export async function confirmWorkSetup[\s\S]*?requireOwnedProjectGeneration/);
  assert.match(projectGenerationSource, /async function requireOwnedProjectGeneration[\s\S]*ensureAcceptedAgreementWorkSetup\(prisma/);
  assert.match(projectGenerationSource, /if \(occurrence\.status !== "awaiting_work_setup"\) continue/);
});

test("start-signing revokes active sign links for those signers before createMany", () => {
  const transaction = startSigningRoute.match(/await prisma\.\$transaction\(async \(tx\) => \{[\s\S]*?\n      \}\);/)[0];
  const revokeIndex = transaction.indexOf("tx.contractReviewLink.updateMany");
  const createIndex = transaction.indexOf("tx.contractReviewLink.createMany");
  assert.ok(revokeIndex >= 0 && createIndex > revokeIndex);
  assert.match(transaction, /signerId: \{ in: \[clientSigner\.id, ownerSigner\.id\] \}/);
  assert.match(transaction, /type: "sign", revokedAt: null/);
});

test("retrying start-signing collides on the active-signer unique index unless existing sign links are revoked first", () => {
  const leftover = [
    { id: "old-client", signerId: "client-1", type: "sign", revokedAt: null },
    { id: "old-owner", signerId: "owner-1", type: "sign", revokedAt: null },
  ];
  assert.throws(
    () => issueActiveSignLinks(leftover, ["client-1", "owner-1"], { revokeFirst: false }),
    (error) => error.code === "P2002",
  );
  const retried = issueActiveSignLinks(leftover, ["client-1", "owner-1"], { revokeFirst: true });
  const active = retried.filter((link) => link.type === "sign" && link.revokedAt == null);
  assert.equal(active.length, 2);
  assert.deepEqual(active.map((link) => link.signerId).sort(), ["client-1", "owner-1"]);
});

test("party-snapshot and typed-name errors stay strict and name the live vs snapshotted party", () => {
  assert.match(contractSignRoute, /The typed name must match the named party exactly[\s\S]*save a new version/);
  assert.match(finalizeRoute, /live client is now[\s\S]*save a new version before finalizing/);
  assert.match(finalizeRoute, /live owner is now[\s\S]*save a new version before finalizing/);
  assert.match(startSigningRoute, /live client is now[\s\S]*save a new version before starting recorded acceptance/);
  assert.match(startSigningRoute, /live owner is now[\s\S]*save a new version before starting recorded acceptance/);
  assert.match(contractSignRoute, /typedName\.toLocaleLowerCase\(\) !== link!\.signer!\.name\.trim\(\)\.toLocaleLowerCase\(\)/);
});

test("accepted billing park keeps on-signing eligible-at as the executed timestamp", () => {
  const executedAt = new Date("2026-09-05T12:00:00.000Z");
  const due = new Date("2026-10-01T12:00:00.000Z");
  assert.deepEqual(acceptedWorkSetupBillingPark(executedAt, { triggerType: "on_signing", triggerDate: null }), {
    status: "awaiting_work_setup",
    eligibleAt: executedAt,
  });
  assert.deepEqual(acceptedWorkSetupBillingPark(executedAt, { triggerType: "fixed_date", triggerDate: due }), {
    status: "awaiting_work_setup",
    eligibleAt: due,
  });
  assert.deepEqual(acceptedWorkSetupBillingPark(executedAt, { triggerType: "milestone_completed", triggerDate: null }), {
    status: "awaiting_work_setup",
    eligibleAt: null,
  });
});

test("work-setup persist creates a pending generation and parks missing occurrences on an executed Agreement", async () => {
  const executedAt = new Date("2026-09-01T12:00:00.000Z");
  const { client, state } = createWorkSetupClient({
    contract: {
      id: "contract-1",
      userId: "owner-1",
      status: "executed",
      executedAt,
      versions: [{ id: "version-1" }],
      paymentPlanItems: [
        { id: "item-sign", triggerType: "on_signing", triggerDate: null, status: "planned" },
        { id: "item-due", triggerType: "fixed_date", triggerDate: new Date("2026-10-01T12:00:00.000Z"), status: "planned" },
      ],
    },
  });

  const result = await persistAcceptedAgreementWorkSetup(client, { userId: "owner-1", contractId: "contract-1", acceptedVersionId: "version-1" });
  assert.equal(result.createdGeneration, true);
  assert.equal(result.parkedOccurrenceCount, 2);
  assert.equal(state.generations.length, 1);
  assert.equal(state.generations[0].status, "pending");
  assert.equal(state.occurrences.length, 2);
  assert.equal(state.occurrences[0].status, "awaiting_work_setup");
  assert.equal(state.planItems.every((item) => item.status === "active"), true);

  const again = await persistAcceptedAgreementWorkSetup(client, { userId: "owner-1", contractId: "contract-1" });
  assert.equal(again.createdGeneration, false);
  assert.equal(again.parkedOccurrenceCount, 0);
  assert.equal(state.generations.length, 1);
  assert.equal(state.occurrences.length, 2);
});

test("work-setup persist backfills a missing generation row without rewriting existing eligible billing", async () => {
  const executedAt = new Date("2026-08-20T12:00:00.000Z");
  const { client, state } = createWorkSetupClient({
    contract: {
      id: "contract-legacy",
      userId: "owner-1",
      status: "executed",
      executedAt,
      versions: [{ id: "version-legacy" }],
      paymentPlanItems: [
        { id: "item-existing", triggerType: "on_signing", triggerDate: null, status: "active" },
        { id: "item-missing", triggerType: "on_signing", triggerDate: null, status: "planned" },
      ],
    },
    occurrences: [{ paymentPlanItemId: "item-existing", status: "eligible", eligibleAt: executedAt }],
  });

  const result = await persistAcceptedAgreementWorkSetup(client, { userId: "owner-1", contractId: "contract-legacy" });
  assert.equal(result.createdGeneration, true);
  assert.equal(result.parkedOccurrenceCount, 1);
  assert.equal(state.occurrences.find((row) => row.paymentPlanItemId === "item-existing").status, "eligible");
  assert.equal(state.occurrences.find((row) => row.paymentPlanItemId === "item-missing").status, "awaiting_work_setup");
  assert.equal(state.planItems.find((item) => item.id === "item-existing").status, "active");
  assert.equal(state.planItems.find((item) => item.id === "item-missing").status, "active");
});

test("work-setup persist recovers when generation insert races on the unique contract/version key", async () => {
  const { client, state } = createWorkSetupClient({
    contract: {
      id: "contract-1",
      userId: "owner-1",
      status: "executed",
      executedAt: new Date("2026-09-01T12:00:00.000Z"),
      versions: [{ id: "version-1" }],
      paymentPlanItems: [],
    },
    generations: [{ id: "generation-existing", acceptedVersionId: "version-1", status: "pending" }],
    failGenerationCreate: true,
  });
  // Simulate the race: findFirst misses, create hits P2002, then findFirst sees the winner.
  let finds = 0;
  client.projectGenerationRecord.findFirst = async () => {
    finds += 1;
    return finds === 1 ? null : state.generations[0];
  };

  const result = await persistAcceptedAgreementWorkSetup(client, { userId: "owner-1", contractId: "contract-1" });
  assert.equal(result.createdGeneration, false);
  assert.equal(result.generationId, "generation-existing");
  assert.equal(state.generations.length, 1);
});

test("work-setup persist does not invent a row for a contract that is not executed", async () => {
  const { client } = createWorkSetupClient({
    contract: {
      id: "contract-draft",
      userId: "owner-1",
      status: "signing",
      executedAt: null,
      versions: [{ id: "version-1" }],
      paymentPlanItems: [],
    },
  });
  await assert.rejects(
    () => persistAcceptedAgreementWorkSetup(client, { userId: "owner-1", contractId: "contract-draft" }),
    (error) => error instanceof WorkSetupError && error.code === "generation_not_found" && error.status === 404,
  );
});
