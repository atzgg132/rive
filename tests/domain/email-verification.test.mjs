import assert from "node:assert/strict";
import test from "node:test";

import { isEmailVerificationSatisfied } from "../../src/utils/emailVerification.ts";

test("a verified address may receive password-reset mail", () => {
  assert.equal(
    isEmailVerificationSatisfied({
      emailVerifiedAt: new Date("2026-01-01"),
      emailVerificationRequiredAt: new Date("2026-01-01"),
    }),
    true,
  );
});

test("an unverified signup must not receive password-reset mail", () => {
  assert.equal(
    isEmailVerificationSatisfied({
      emailVerifiedAt: null,
      emailVerificationRequiredAt: new Date("2026-08-01"),
    }),
    false,
  );
});

test("a grandfathered account that never had verification required still can", () => {
  assert.equal(
    isEmailVerificationSatisfied({
      emailVerifiedAt: null,
      emailVerificationRequiredAt: null,
    }),
    true,
  );
});
