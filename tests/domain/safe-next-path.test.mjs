import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveLoginDestination,
  safeMigrationNextPath,
  safeNextPath,
} from "../../src/utils/safeNextPath.ts";

test("a migration-intent login resumes the exact safe session URL", () => {
  const next = "/migrate?id=b9635975-8af6-4083-a00c-1a7a00fc2d7e";

  assert.equal(safeMigrationNextPath(next), next);
  assert.equal(resolveLoginDestination("/onboarding", next), next);
});

test("migration resume handling does not widen the safe next-path boundary", () => {
  assert.equal(safeMigrationNextPath("/migrate-else?id=one"), null);
  assert.equal(safeMigrationNextPath("//attacker.example/migrate"), null);
  assert.equal(safeNextPath("https://attacker.example/migrate"), null);
});
