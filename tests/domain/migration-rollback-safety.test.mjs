import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Structural regression guard, not a DB-backed integration test: no database
// dependency, so it runs in the same no-DB `test:domain` suite as the rest of
// tests/domain and can be trusted in any environment.
//
// Migration rollback is fully disabled by policy: src/utils/migration/rollback.ts
// no longer touches Prisma at all (previewRollback/executeRollback are fixed
// "disabled" responses), and every route that used to expose deletion now
// returns a bounded 410. This test fails the build if any of those routes ever
// reintroduces a live deleteMany call, or if rollback.ts regains one.

const routesToCheck = [
  ["legacy onboarding rollback route", "../../src/app/api/onboarding/import/jobs/[id]/route.ts"],
  ["v2 migration rollback route", "../../src/app/api/migrations/[id]/rollback/route.ts"],
];

const rollbackModulePath = fileURLToPath(new URL("../../src/utils/migration/rollback.ts", import.meta.url));
const rollbackModuleSource = readFileSync(rollbackModulePath, "utf8");

for (const [label, relativePath] of routesToCheck) {
  const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

  test(`${label} contains no live record deletion`, () => {
    for (const model of ["expense", "invoice", "project", "client", "importedRecord", "importJob"]) {
      assert.doesNotMatch(
        source,
        new RegExp(`${model}\\.delete(Many)?\\(`, "i"),
        `${model}.delete(Many) must not appear in the ${label}`,
      );
    }
  });

  test(`${label} responds with a bounded refusal rather than performing an action`, () => {
    assert.match(source, /410/, `${label} should refuse with a 410 rather than silently succeeding`);
  });
}

test("the audited rollback module cannot delete a record even if called directly", () => {
  assert.doesNotMatch(
    rollbackModuleSource,
    /prisma\./i,
    "rollback.ts must not touch the database at all while rollback is disabled by policy",
  );
  for (const model of ["expense", "invoice", "project", "client"]) {
    assert.doesNotMatch(
      rollbackModuleSource,
      new RegExp(`${model}\\.delete(Many)?\\(`, "i"),
      `${model}.delete(Many) must not appear in rollback.ts`,
    );
  }
});
