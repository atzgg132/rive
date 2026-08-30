import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { parseMigrationWorkMessage } from "../../src/utils/migration/queue.ts";

test("migration queue messages accept only the versioned opaque work contract", () => {
  assert.deepEqual(parseMigrationWorkMessage({
    version: 1,
    environment: "dev",
    migrationId: "migration-id",
    operation: "commit",
    inputRevision: 3,
    planHash: "hash",
  }), {
    version: 1,
    environment: "dev",
    migrationId: "migration-id",
    operation: "commit",
    inputRevision: 3,
    planHash: "hash",
  });
  assert.equal(parseMigrationWorkMessage({ version: 2, environment: "dev", migrationId: "id", operation: "commit", inputRevision: 0 }), null);
  assert.equal(parseMigrationWorkMessage({ version: 1, environment: "dev", migrationId: "id", operation: "delete", inputRevision: 0 }), null);
  assert.equal(parseMigrationWorkMessage({ version: 1, environment: "dev", migrationId: "id", operation: "analyze", inputRevision: -1 }), null);
});

test("the hosted queue consumer reports per-message failures and uses the internal worker", async () => {
  const [jobs, runner] = await Promise.all([
    readFile(new URL("../../infrastructure/aws/jobs.tf", import.meta.url), "utf8"),
    readFile(new URL("../../infrastructure/aws/lambda/job_runner.py", import.meta.url), "utf8"),
  ]);
  assert.match(jobs, /aws_lambda_event_source_mapping[\s\S]*?ReportBatchItemFailures/);
  assert.match(jobs, /batch_size\s*=\s*1/);
  assert.match(runner, /\/api\/internal\/migrations\/worker/);
  assert.match(runner, /batchItemFailures/);
});
