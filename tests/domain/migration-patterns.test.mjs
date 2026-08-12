import assert from "node:assert/strict";
import test from "node:test";

import {
  currencyTokenToIso,
  isEmail,
  isIdentifierLike,
  isNumeric,
  isPhone,
  isUrl,
  parseBoolean,
  parseMoney,
} from "../../src/lib/migration/patterns.ts";
import {
  inferColumnDatePreference,
  parseDateValue,
  toDateOnlyString,
} from "../../src/lib/migration/normalize/date.ts";

test("recognises real email addresses and rejects prose containing @", () => {
  assert.equal(isEmail("contact@acme.com"), true);
  assert.equal(isEmail("Contact.Person+tag@sub.acme.co.in"), true);
  assert.equal(isEmail("email us at contact@acme.com"), false);
  assert.equal(isEmail("acme.com"), false);
  assert.equal(isEmail("a@b"), false);
});

test("separates phone numbers from amounts and identifiers", () => {
  assert.equal(isPhone("+91 98765 43210"), true);
  assert.equal(isPhone("(555) 010-9999"), true);
  assert.equal(isPhone("1234.56"), false);
  assert.equal(isPhone("INV-001"), false);
  assert.equal(isPhone("12345"), false, "too few digits to be a phone number");
});

test("detects identifier-shaped values without swallowing money", () => {
  assert.equal(isIdentifierLike("INV-001"), true);
  assert.equal(isIdentifierLike("2026/044"), true);
  assert.equal(isIdentifierLike("TXN12345"), true);
  assert.equal(isIdentifierLike("1,000.50"), false);
  assert.equal(isIdentifierLike("Acme Technologies"), false);
});

test("parses monetary values across locale and accounting formats", () => {
  assert.equal(parseMoney("1,000.50")?.amount, 1000.5);
  assert.equal(parseMoney("1000.50")?.amount, 1000.5);
  assert.equal(parseMoney("1.000,50")?.amount, 1000.5, "European grouping");
  assert.equal(parseMoney("1 000,50")?.amount, 1000.5, "space grouping");
  assert.equal(parseMoney("75000")?.amount, 75000);
  assert.equal(parseMoney("1,234")?.amount, 1234, "single group of three is thousands");
  assert.equal(parseMoney("1.23")?.amount, 1.23, "two trailing digits is a decimal");
});

test("treats accounting negatives and trailing minus as negative", () => {
  assert.equal(parseMoney("(500)")?.amount, -500);
  assert.equal(parseMoney("(1,200.00)")?.amount, -1200);
  assert.equal(parseMoney("-450.25")?.amount, -450.25);
  assert.equal(parseMoney("450.25-")?.amount, -450.25);
});

test("extracts unambiguous currency but refuses to resolve the dollar sign", () => {
  assert.equal(parseMoney("₹1,000")?.currency, "INR");
  assert.equal(parseMoney("€2.500,00")?.currency, "EUR");
  assert.equal(parseMoney("£99")?.currency, "GBP");

  const dollars = parseMoney("$1,000");
  assert.equal(dollars?.currency, null, "$ must never be silently resolved");
  assert.deepEqual(dollars?.ambiguousCurrencies.includes("USD"), true);
  assert.deepEqual(dollars?.ambiguousCurrencies.includes("CAD"), true);
});

test("returns null for values that are not money at all", () => {
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("n/a"), null);
  assert.equal(parseMoney("pending"), null);
});

test("maps loose currency tokens to ISO codes", () => {
  assert.equal(currencyTokenToIso("Rs/-").currency, "INR");
  assert.equal(currencyTokenToIso("inr").currency, "INR");
  assert.equal(currencyTokenToIso("₹").currency, "INR");
  assert.equal(currencyTokenToIso("EUR").currency, "EUR");
  assert.equal(currencyTokenToIso("$").currency, null);
  assert.deepEqual(currencyTokenToIso("$").ambiguous.includes("USD"), true);
});

test("parses ISO dates without shifting the calendar day", () => {
  const parsed = parseDateValue("2026-04-03");
  assert.equal(parsed?.iso, "2026-04-03");
  assert.equal(parsed?.ambiguous, false);
  assert.equal(toDateOnlyString(parsed.date), "2026-04-03");
  assert.equal(parsed.date.getUTCHours(), 0);
});

test("flags 03/04/2026 as ambiguous and keeps the alternative reading", () => {
  const parsed = parseDateValue("03/04/2026");
  assert.equal(parsed?.ambiguous, true);
  assert.equal(parsed?.iso, "2026-04-03", "defaults to day-first");
  assert.equal(parsed?.alternative, "2026-03-04");
});

test("does not flag ambiguity when only one reading is a real date", () => {
  const dayFirst = parseDateValue("13/04/2026");
  assert.equal(dayFirst?.ambiguous, false);
  assert.equal(dayFirst?.iso, "2026-04-13");

  const monthFirst = parseDateValue("04/13/2026");
  assert.equal(monthFirst?.ambiguous, false);
  assert.equal(monthFirst?.iso, "2026-04-13");
});

test("parses textual and two-digit-year dates", () => {
  assert.equal(parseDateValue("3 Apr 2026")?.iso, "2026-04-03");
  assert.equal(parseDateValue("April 3, 2026")?.iso, "2026-04-03");
  assert.equal(parseDateValue("3rd April 2026")?.iso, "2026-04-03");
  assert.equal(parseDateValue("03/04/26")?.iso, "2026-04-03");
});

test("rejects impossible and non-date values", () => {
  assert.equal(parseDateValue("32/01/2026"), null);
  assert.equal(parseDateValue("2026-13-01"), null);
  assert.equal(parseDateValue("not a date"), null);
  assert.equal(parseDateValue(""), null);
});

test("uses an unambiguous sibling row to settle a whole date column", () => {
  const dmy = inferColumnDatePreference(["03/04/2026", "17/04/2026", "01/05/2026"]);
  assert.equal(dmy.preference, "dmy");

  const mdy = inferColumnDatePreference(["03/04/2026", "04/17/2026"]);
  assert.equal(mdy.preference, "mdy");

  const unresolved = inferColumnDatePreference(["03/04/2026", "05/06/2026"]);
  assert.equal(unresolved.preference, "auto", "no evidence means no guess");
});

test("applies a column preference to otherwise ambiguous values", () => {
  assert.equal(parseDateValue("03/04/2026", "mdy")?.iso, "2026-03-04");
  assert.equal(parseDateValue("03/04/2026", "dmy")?.iso, "2026-04-03");
  assert.equal(parseDateValue("13/04/2026", "mdy")?.iso, "2026-04-13", "evidence beats preference");
});

test("classifies simple primitives used by the profiler", () => {
  assert.equal(isNumeric("1,234.56"), true);
  assert.equal(isNumeric("abc"), false);
  assert.equal(isUrl("https://acme.com"), true);
  assert.equal(isUrl("www.acme.com/work"), true);
  assert.equal(parseBoolean("Yes"), true);
  assert.equal(parseBoolean("no"), false);
  assert.equal(parseBoolean("maybe"), null);
});
