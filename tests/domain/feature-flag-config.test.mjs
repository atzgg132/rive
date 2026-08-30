import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const parameters = await readFile(
  new URL("../../infrastructure/aws/parameters.tf", import.meta.url),
  "utf8",
);
test("every deploy receives an explicit disabled Migration Engine flag", () => {
  assert.match(
    parameters,
    /"\$\{environment\}\/MIGRATION_ENGINE_ENABLED"\s*=\s*"false"/,
  );
});

test("engagement flow rolls out on dev before production", () => {
  assert.match(
    parameters,
    /"\$\{environment\}\/ENGAGEMENT_FLOW_ENABLED"\s*=\s*environment\s*==\s*"dev"\s*\?\s*"true"\s*:\s*"false"/,
  );
});
