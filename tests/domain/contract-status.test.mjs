import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertValidStatusTransition,
  buildContractStatusUpdate,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_TRANSITIONS,
} from "../../src/utils/contractStatus.ts";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function transition(current, next) {
  assert.doesNotThrow(() => assertValidStatusTransition(current, next), `${current} -> ${next} should be allowed`);
}

function rejected(current, next) {
  assert.throws(() => assertValidStatusTransition(current, next), `${current} -> ${next} should be rejected`);
}

test("every declared Contract state has a transition entry", () => {
  assert.deepEqual(Object.keys(CONTRACT_STATUS_TRANSITIONS).sort(), [...CONTRACT_STATUSES].sort());
  for (const status of CONTRACT_STATUSES) {
    assert.ok(Array.isArray(CONTRACT_STATUS_TRANSITIONS[status]));
  }
});

test("every declared allowed transition is accepted", () => {
  for (const [current, nextStates] of Object.entries(CONTRACT_STATUS_TRANSITIONS)) {
    for (const next of nextStates) transition(current, next);
  }
});

test("every undeclared transition is rejected", () => {
  for (const current of CONTRACT_STATUSES) {
    for (const next of CONTRACT_STATUSES) {
      if (current === next || CONTRACT_STATUS_TRANSITIONS[current].includes(next)) continue;
      rejected(current, next);
    }
  }
});

test("same-state transitions are idempotent for every state", () => {
  for (const status of CONTRACT_STATUSES) transition(status, status);
});

test("unregistered statuses are rejected even for same-state updates", () => {
  rejected("unregistered", "unregistered");
  assert.throws(() => buildContractStatusUpdate({ where: { id: "contract-1" }, from: "draft", to: "unregistered" }));
});

test("starting is a live state with provider-failure recovery", () => {
  transition("ready_to_sign", "starting");
  transition("starting", "signing");
  transition("starting", "ready_to_sign");
  rejected("starting", "executed");
});

test("partial acceptance can be declined and recovered through a new version", () => {
  transition("signing", "declined");
  transition("declined", "draft");
  transition("draft", "in_review");
  transition("in_review", "ready_to_sign");
  transition("ready_to_sign", "starting");
});

test("expiry supports reissue and finalization without bypassing review", () => {
  transition("in_review", "expired");
  transition("expired", "in_review");
  transition("expired", "ready_to_sign");
  transition("signing", "expired");
  rejected("expired", "signing");
});

test("void and executed records cannot be edited or accepted again", () => {
  for (const next of ["draft", "in_review", "ready_to_sign", "starting", "signing"]) {
    rejected("void", next);
    rejected("executed", next);
  }
  transition("void", "void");
  transition("executed", "void");
});

test("version replacement binds the expected current state", () => {
  for (const current of ["draft", "in_review", "ready_to_sign", "declined", "expired"]) {
    const update = buildContractStatusUpdate({ where: { id: "contract-1" }, from: current, to: "draft", data: { title: "new version" } });
    assert.equal(update.where.status, current);
    assert.equal(update.data.status, "draft");
  }
});

test("stale expected-state updates cannot silently target another state", () => {
  const update = buildContractStatusUpdate({ where: { id: "contract-1" }, from: "ready_to_sign", to: "starting" });
  assert.deepEqual(update.where, { id: "contract-1", status: "ready_to_sign" });
  rejected("in_review", "starting");
});

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

test("route code has no raw Contract status writer outside the transition service", async () => {
  const files = [
    ...(await collectFiles(join(repositoryRoot, "src", "app", "api"))),
    ...(await collectFiles(join(repositoryRoot, "src", "utils"))),
  ].filter((file) => !file.endsWith("src\\utils\\contracts.ts") && !file.endsWith("src/utils/contracts.ts"));
  const violations = [];
  const rawStatusWrite = /(?:tx|prisma)\.contract\.(?:update|updateMany)\([\s\S]{0,1200}?data\s*:\s*\{[\s\S]{0,220}?\bstatus\s*:/g;
  const rawCreateStatus = /(?:tx|prisma)\.contract\.create\([\s\S]{0,1200}?data\s*:\s*\{[\s\S]{0,220}?\bstatus\s*:/g;
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (rawStatusWrite.test(source) || rawCreateStatus.test(source)) violations.push(file);
    rawStatusWrite.lastIndex = 0;
    rawCreateStatus.lastIndex = 0;
  }
  assert.deepEqual(violations, [], `Raw Contract status writers found: ${violations.join(", ")}`);
});
