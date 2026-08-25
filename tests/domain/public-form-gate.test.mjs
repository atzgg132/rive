import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePublicFormGate,
  PUBLIC_FORM_MAX_SUBMIT_MS,
  PUBLIC_FORM_MIN_SUBMIT_MS,
  PUBLIC_FORM_RATE_LIMITS,
} from "../../src/utils/publicFormGate.ts";

const now = 1_700_000_000_000;
const human = { startedAt: now - 8_000 };

test("a submission that waited long enough and left the honeypot empty is allowed", () => {
  assert.deepEqual(evaluatePublicFormGate(human, now), { ok: true });
});

test("a filled honeypot is reported distinctly, even when timing is valid", () => {
  const result = evaluatePublicFormGate({ ...human, website: "http://spam.example" }, now);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "honeypot");
});

test("whitespace-only honeypot values do not trip the gate", () => {
  assert.equal(evaluatePublicFormGate({ ...human, website: "   " }, now).ok, true);
});

test("an instant POST is too fast", () => {
  const result = evaluatePublicFormGate({ startedAt: now }, now);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "too_fast");
});

test("a submit just under the minimum dwell is too fast", () => {
  const result = evaluatePublicFormGate({ startedAt: now - (PUBLIC_FORM_MIN_SUBMIT_MS - 1) }, now);
  assert.equal(result.reason, "too_fast");
});

test("a submit at the minimum dwell is allowed", () => {
  assert.equal(evaluatePublicFormGate({ startedAt: now - PUBLIC_FORM_MIN_SUBMIT_MS }, now).ok, true);
});

test("a missing startedAt is treated as too fast, not as a validation error", () => {
  const result = evaluatePublicFormGate({ name: "Ada" }, now);
  assert.equal(result.reason, "too_fast");
});

test("a non-numeric startedAt is treated as too fast", () => {
  assert.equal(evaluatePublicFormGate({ startedAt: "yesterday" }, now).reason, "too_fast");
});

test("a 13-digit numeric string is accepted as startedAt", () => {
  assert.equal(evaluatePublicFormGate({ startedAt: String(now - 8_000) }, now).ok, true);
});

test("a form left open past the maximum age is stale", () => {
  const result = evaluatePublicFormGate({ startedAt: now - PUBLIC_FORM_MAX_SUBMIT_MS - 1 }, now);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "stale");
});

test("a future startedAt counts as too fast rather than allowed", () => {
  assert.equal(evaluatePublicFormGate({ startedAt: now + 30_000 }, now).reason, "too_fast");
});

test("a null or non-object body is too fast, not a throw", () => {
  assert.equal(evaluatePublicFormGate(null, now).reason, "too_fast");
  assert.equal(evaluatePublicFormGate("body", now).reason, "too_fast");
});

test("public form rate limits cap IP and email on every mail-sending surface", () => {
  assert.equal(PUBLIC_FORM_RATE_LIMITS.contact.ip.limit, 5);
  assert.equal(PUBLIC_FORM_RATE_LIMITS.contact.email.limit, 3);
  assert.equal(PUBLIC_FORM_RATE_LIMITS.register.ip.limit, 12);
  assert.equal(PUBLIC_FORM_RATE_LIMITS.register.email.limit, 4);
  assert.equal(PUBLIC_FORM_RATE_LIMITS.forgotPassword.ip.limit, 5);
  assert.equal(PUBLIC_FORM_RATE_LIMITS.forgotPassword.email.limit, 3);
});
