import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// This is a structural regression guard, not a DB-backed integration test: it has
// no database dependency, so it runs in the same no-DB `test:domain` suite as the
// rest of tests/domain and can be trusted in any environment.
//
// The gap it locks in place: the legacy onboarding "Undo import" route used to
// delete every record an import created, with no check for whether the user had
// edited it since. src/utils/migration/rollback.ts's executeRollback() has that
// check (rollbackEligibility, covered by migration-state.test.mjs) and is the only
// vetted rollback implementation in the codebase. This test fails loudly if the
// legacy route (or any future migration-rollback route) reintroduces its own
// unaudited deleteMany call instead of delegating to it.

const legacyRoutePath = fileURLToPath(
  new URL("../../src/app/api/onboarding/import/jobs/[id]/route.ts", import.meta.url),
);
const legacyRouteSource = readFileSync(legacyRoutePath, "utf8");

const v2RollbackRoutePath = fileURLToPath(
  new URL("../../src/app/api/migrations/[id]/rollback/route.ts", import.meta.url),
);
const v2RollbackRouteSource = readFileSync(v2RollbackRoutePath, "utf8");

test("the legacy onboarding rollback route delegates to the audited rollback module", () => {
  assert.match(
    legacyRouteSource,
    /from ["']@\/utils\/migration\/rollback["']/,
    "the legacy route must import executeRollback from the audited module, not reimplement rollback",
  );
  assert.match(legacyRouteSource, /executeRollback\(/, "the legacy route must call executeRollback(), not delete directly");
});

test("the legacy onboarding rollback route contains no raw record deletion", () => {
  // expense/invoice/project/client are the entity types a migration can create.
  // None of them should ever be deleted directly from this route — only
  // executeRollback (which applies rollbackEligibility per record) may do that.
  for (const model of ["expense", "invoice", "project", "client"]) {
    assert.doesNotMatch(
      legacyRouteSource,
      new RegExp(`${model}\\.deleteMany`, "i"),
      `${model}.deleteMany must not appear directly in the legacy rollback route`,
    );
  }
});

test("the v2 migration rollback route also delegates to the audited rollback module", () => {
  assert.match(
    v2RollbackRouteSource,
    /from ["']@\/utils\/migration\/rollback["']/,
    "the v2 rollback route must call into the audited rollback module",
  );
  for (const model of ["expense", "invoice", "project", "client"]) {
    assert.doesNotMatch(
      v2RollbackRouteSource,
      new RegExp(`${model}\\.deleteMany`, "i"),
      `${model}.deleteMany must not appear directly in the v2 rollback route`,
    );
  }
});
