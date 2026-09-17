import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidEmailAddress,
  normalizeEmailAddress,
  parseEmailAddress,
} from "../../src/lib/email-address.ts";

test("normalizes case and surrounding whitespace", () => {
  const parsed = parseEmailAddress("  Jane.Doe@Company.COM  ");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value, "jane.doe@company.com");
  assert.equal(normalizeEmailAddress(" USER@EXAMPLE.ORG "), "user@example.org");
});

test("missing values report missing", () => {
  for (const value of [undefined, null, "", "   ", 42, {}, [], true]) {
    const result = parseEmailAddress(value);
    assert.equal(result.ok, false, String(value));
    assert.equal(result.reason, "missing", String(value));
  }
});

test("accepts the full permitted local-part alphabet", () => {
  for (const local of [
    "jane",
    "jane.doe",
    "jane+tag",
    "o'neil",
    "a!#$%&*+-/=?^_`{|}~",
    "x",
  ]) {
    assert.equal(parseEmailAddress(`${local}@example.com`).ok, true, local);
  }
});

test("rejects dots at the edges and consecutive dots in the local part", () => {
  for (const local of [".jane", "jane.", "ja..ne", "..", ".", "j..ane"]) {
    const result = parseEmailAddress(`${local}@example.com`);
    assert.equal(result.ok, false, local);
    assert.equal(result.reason, "invalid_format", local);
  }
});

test("rejects disallowed and non-ASCII characters in the local part", () => {
  for (const local of ["ja ne", 'ja"ne', "janeü", "jane(d)", "jane\\doe", "jane,doe"]) {
    assert.equal(parseEmailAddress(`${local}@example.com`).ok, false, local);
  }
});

test("a quoted local part is unsupported", () => {
  assert.equal(parseEmailAddress('"jane doe"@example.com').ok, false);
});

test("requires exactly one at sign", () => {
  for (const value of ["janeexample.com", "jane@@example.com", "jane@exa@mple.com", "jane@", "@example.com"]) {
    assert.equal(parseEmailAddress(value).ok, false, value);
  }
});

test("rejects empty and consecutive domain labels", () => {
  for (const domain of [".example.com", "example..com", "example.com.", "example.", "."]) {
    assert.equal(parseEmailAddress(`jane@${domain}`).ok, false, domain);
  }
});

test("rejects a single-label domain", () => {
  assert.equal(parseEmailAddress("jane@localhost").ok, false);
  assert.equal(parseEmailAddress("jane@com").ok, false);
});

test("rejects labels that start or end with a hyphen", () => {
  for (const domain of ["-example.com", "example-.com", "exa-mple.-com", "example.c-"]) {
    assert.equal(parseEmailAddress(`jane@${domain}`).ok, false, domain);
  }
  assert.equal(parseEmailAddress("jane@my-domain.example.com").ok, true);
});

test("rejects labels over 63 characters", () => {
  assert.equal(parseEmailAddress(`jane@${"a".repeat(63)}.com`).ok, true);
  assert.equal(parseEmailAddress(`jane@${"a".repeat(64)}.com`).ok, false);
});

test("the final label must be letters or punycode, never digits or one letter", () => {
  assert.equal(parseEmailAddress("jane@example.com").ok, true);
  assert.equal(parseEmailAddress("jane@example.c").ok, false);
  assert.equal(parseEmailAddress("jane@example.123").ok, false);
  assert.equal(parseEmailAddress("jane@example.c-m").ok, false);
  assert.equal(parseEmailAddress("jane@example.xn--p1ai").ok, true);
  assert.equal(parseEmailAddress("jane@example.xn--").ok, false);
});

test("rejects non-ASCII domains even when the shape is otherwise fine", () => {
  assert.equal(parseEmailAddress("jane@münchen.de").ok, false);
  assert.equal(parseEmailAddress("jane@xn--mnich-kva.de").ok, true);
});

test("enforces the 254 character ceiling and 64 character local bound", () => {
  const maxLocal = "a".repeat(64);
  const domain = `${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  assert.equal(`${maxLocal}@${domain}`.length, 254);
  assert.equal(parseEmailAddress(`${maxLocal}@${domain}`).ok, true);

  const tooLong = `${maxLocal}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`;
  assert.equal(tooLong.length, 255);
  const longResult = parseEmailAddress(tooLong);
  assert.equal(longResult.ok, false);
  assert.equal(longResult.reason, "too_long");

  const longLocal = parseEmailAddress(`${"a".repeat(65)}@example.com`);
  assert.equal(longLocal.ok, false);
  assert.equal(longLocal.reason, "too_long");
});

test("requires at least three characters overall", () => {
  assert.equal(parseEmailAddress("a@b").ok, false);
  assert.equal(parseEmailAddress("ab").reason, "invalid_format");
});

test("rejects the production regression jj.jkj@.", () => {
  const result = parseEmailAddress("jj.jkj@.");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_format");
  assert.equal(isValidEmailAddress("jj.jkj@."), false);
  assert.equal(normalizeEmailAddress("jj.jkj@."), null);
});

test("isValidEmailAddress and normalizeEmailAddress mirror the parser", () => {
  assert.equal(isValidEmailAddress("jane@example.com"), true);
  assert.equal(isValidEmailAddress("not-an-email"), false);
  assert.equal(isValidEmailAddress(123), false);
  assert.equal(normalizeEmailAddress("Jane@Example.com"), "jane@example.com");
  assert.equal(normalizeEmailAddress("not-an-email"), null);
});
