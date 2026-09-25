import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysToIsoDate,
  isValidPaymentTermsDays,
  isValidWorkspaceCurrency,
  resolveRecordCurrency,
  validateBusinessTypes,
} from "../../src/lib/settingsDomain.ts";

test("a linked project's currency wins over the workspace default", () => {
  assert.equal(resolveRecordCurrency({ projectCurrency: "EUR", workspaceCurrency: "USD" }), "EUR");
});

test("falls back to the workspace default when no project is linked", () => {
  assert.equal(resolveRecordCurrency({ projectCurrency: null, workspaceCurrency: "INR" }), "INR");
  assert.equal(resolveRecordCurrency({ workspaceCurrency: "INR" }), "INR");
});

test("falls back to USD when neither the project nor the workspace has a usable currency", () => {
  assert.equal(resolveRecordCurrency({}), "USD");
  assert.equal(resolveRecordCurrency({ projectCurrency: "", workspaceCurrency: "" }), "USD");
  assert.equal(resolveRecordCurrency({ projectCurrency: "not-a-currency" }), "USD");
});

test("workspace currency validation matches the existing 3-letter ISO-ish pattern", () => {
  assert.equal(isValidWorkspaceCurrency("USD"), true);
  assert.equal(isValidWorkspaceCurrency("usd"), false);
  assert.equal(isValidWorkspaceCurrency("US"), false);
  assert.equal(isValidWorkspaceCurrency("ZZZ"), false, "not an ISO 4217 code");
  assert.equal(isValidWorkspaceCurrency("INR"), true);
  assert.equal(isValidWorkspaceCurrency(""), false);
  assert.equal(isValidWorkspaceCurrency(42), false);
});

test("business type validation rejects unsupported values, dedupes, and requires at least one", () => {
  assert.deepEqual(validateBusinessTypes(["freelancer", "studio", "freelancer"]), ["freelancer", "studio"]);
  assert.equal(validateBusinessTypes([]), null);
  assert.equal(validateBusinessTypes(["not-a-type"]), null);
  assert.equal(validateBusinessTypes(["freelancer", 42]), null);
  assert.equal(validateBusinessTypes("freelancer"), null);
});

test("payment terms days must be a whole number within a sane range", () => {
  assert.equal(isValidPaymentTermsDays(0), true);
  assert.equal(isValidPaymentTermsDays(30), true);
  assert.equal(isValidPaymentTermsDays(365), true);
  assert.equal(isValidPaymentTermsDays(366), false);
  assert.equal(isValidPaymentTermsDays(-1), false);
  assert.equal(isValidPaymentTermsDays(1.5), false);
  assert.equal(isValidPaymentTermsDays("30"), false);
});

test("default payment terms prefill a due date from the issue date", () => {
  assert.equal(addDaysToIsoDate("2026-09-24", 15), "2026-10-09");
  assert.equal(addDaysToIsoDate("2026-09-24", 0), "2026-09-24");
  assert.equal(addDaysToIsoDate("not-a-date", 15), null);
  assert.equal(addDaysToIsoDate("2026-09-24", NaN), null);
});
