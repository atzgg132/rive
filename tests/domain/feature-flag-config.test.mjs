import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const parameters = await readFile(
  new URL("../../infrastructure/aws/parameters.tf", import.meta.url),
  "utf8",
);
test("the Migration Engine kill switch is operator-managed and defaults off", () => {
  assert.match(parameters, /"dev\/MIGRATION_ENGINE_ENABLED"\s*=\s*"false"/);
  assert.match(parameters, /"prod\/MIGRATION_ENGINE_ENABLED"\s*=\s*"false"/);
  assert.match(parameters, /aws_ssm_parameter\.operator_managed\["dev\/MIGRATION_ENGINE_ENABLED"\]/);
  assert.match(parameters, /aws_ssm_parameter\.operator_managed\["prod\/MIGRATION_ENGINE_ENABLED"\]/);
});

test("engagement flow rolls out on dev before production", () => {
  assert.match(
    parameters,
    /"\$\{environment\}\/ENGAGEMENT_FLOW_ENABLED"\s*=\s*environment\s*==\s*"dev"\s*\?\s*"true"\s*:\s*"false"/,
  );
});
