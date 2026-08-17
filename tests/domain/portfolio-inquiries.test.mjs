import assert from "node:assert/strict";
import test from "node:test";

import {
  INQUIRY_FIELD_LIMITS,
  INQUIRY_RATE_LIMITS,
  INQUIRY_STATUSES,
  inquiryExcerpt,
  inquiryPayloadFingerprint,
  inquiryRateLimitKey,
  inquiryStatusTransition,
  isInquiryStatus,
  MAX_INQUIRY_BODY_BYTES,
  parseInquiryPageSize,
  validateInquirySubmission,
} from "../../src/utils/portfolioInquiries.ts";

const valid = {
  name: "Jane Smith",
  email: "Jane@Company.com",
  projectType: "Website redesign",
  message: "We are rebuilding our marketing site and would like to talk about scope and timing.",
};

/* --------------------------------------------------------------------- */
/* Validation                                                            */
/* --------------------------------------------------------------------- */

test("accepts a complete submission and normalizes what it stores", () => {
  const result = validateInquirySubmission({ ...valid, name: "  Jane Smith  " });

  assert.equal(result.ok, true);
  assert.equal(result.value.name, "Jane Smith", "whitespace is trimmed");
  assert.equal(result.value.email, "jane@company.com", "addresses are lower-cased for matching");
  assert.equal(result.value.sourceProjectId, null);
});

test("a filled honeypot is reported distinctly from a validation failure", () => {
  const result = validateInquirySubmission({ ...valid, website: "http://spam.example" });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "honeypot", "the route must be able to answer 200 and store nothing");
});

test("the honeypot wins even when every other field is valid", () => {
  assert.equal(validateInquirySubmission({ ...valid, website: " x " }).reason, "honeypot");
});

test("rejects every incomplete or out-of-range field", () => {
  const cases = {
    "missing name": { ...valid, name: "" },
    "name too short": { ...valid, name: "J" },
    "name too long": { ...valid, name: "J".repeat(INQUIRY_FIELD_LIMITS.name.max + 1) },
    "missing email": { ...valid, email: "" },
    "malformed email": { ...valid, email: "jane@@company" },
    "email without domain": { ...valid, email: "jane@company" },
    "email too long": { ...valid, email: `${"j".repeat(INQUIRY_FIELD_LIMITS.email.max)}@company.com` },
    "missing project type": { ...valid, projectType: "" },
    "project type too long": { ...valid, projectType: "p".repeat(INQUIRY_FIELD_LIMITS.projectType.max + 1) },
    "message too short": { ...valid, message: "hi" },
    "message too long": { ...valid, message: "m".repeat(INQUIRY_FIELD_LIMITS.message.max + 1) },
    "not an object": "just a string",
    "null body": null,
  };

  for (const [label, body] of Object.entries(cases)) {
    const result = validateInquirySubmission(body);
    assert.equal(result.ok, false, label);
    assert.equal(result.reason, "invalid", label);
  }
});

test("non-string fields cannot smuggle past validation", () => {
  assert.equal(validateInquirySubmission({ ...valid, name: { toString: () => "Jane" } }).ok, false);
  assert.equal(validateInquirySubmission({ ...valid, message: ["a".repeat(50)] }).ok, false);
  assert.equal(validateInquirySubmission({ ...valid, email: 12345 }).ok, false);
});

test("keeps a plausible source project and discards anything oversized", () => {
  assert.equal(
    validateInquirySubmission({ ...valid, sourceProjectId: "project-abc123" }).value.sourceProjectId,
    "project-abc123",
  );
  assert.equal(
    validateInquirySubmission({ ...valid, sourceProjectId: "p".repeat(200) }).value.sourceProjectId,
    null,
  );
  assert.equal(validateInquirySubmission({ ...valid, sourceProjectId: 42 }).value.sourceProjectId, null);
});

test("the body size ceiling leaves room for a maximum-length message", () => {
  const largest = JSON.stringify({
    name: "n".repeat(INQUIRY_FIELD_LIMITS.name.max),
    email: `${"e".repeat(300)}@company.com`,
    projectType: "p".repeat(INQUIRY_FIELD_LIMITS.projectType.max),
    message: "m".repeat(INQUIRY_FIELD_LIMITS.message.max),
    sourceProjectId: "s".repeat(120),
  });

  assert.ok(
    Buffer.byteLength(largest, "utf8") < MAX_INQUIRY_BODY_BYTES,
    "a valid maximum submission must never be refused for size",
  );
});

/* --------------------------------------------------------------------- */
/* Abuse limits                                                          */
/* --------------------------------------------------------------------- */

test("every abuse scope has a positive cap over a bounded window", () => {
  for (const [scope, { limit, windowMs }] of Object.entries(INQUIRY_RATE_LIMITS)) {
    assert.ok(limit > 0, `${scope} limit`);
    assert.ok(windowMs > 0, `${scope} window`);
  }
});

test("the caps are ordered so the tightest scope binds first", () => {
  const { fingerprint, sender, visitor, portfolio, global } = INQUIRY_RATE_LIMITS;

  assert.ok(fingerprint.limit <= sender.limit, "an identical payload is more suspicious than a repeat sender");
  assert.ok(sender.limit <= visitor.limit);
  assert.ok(visitor.limit <= portfolio.limit, "one visitor must not be able to exhaust an owner's whole allowance");
  assert.ok(portfolio.limit <= global.limit);
});

test("rate limit keys are namespaced per scope and per subject", () => {
  assert.equal(inquiryRateLimitKey("portfolio", "jane"), "portfolio-inquiry:portfolio:jane");
  assert.equal(inquiryRateLimitKey("global"), "portfolio-inquiry:global");
  assert.notEqual(
    inquiryRateLimitKey("visitor", "jane", "hash"),
    inquiryRateLimitKey("sender", "jane", "hash"),
    "scopes must never share a bucket",
  );
  assert.notEqual(inquiryRateLimitKey("visitor", "jane", "a"), inquiryRateLimitKey("visitor", "jane", "b"));
  assert.notEqual(
    inquiryRateLimitKey("portfolio", "jane"),
    inquiryRateLimitKey("portfolio", "john"),
    "one portfolio's traffic must not throttle another's",
  );
});

test("payload fingerprints survive cosmetic edits but track real ones", () => {
  const base = { slug: "jane", projectType: "Website redesign", message: "Hello there, we need a new site." };
  const cosmetic = { slug: "jane", projectType: "  website   REDESIGN ", message: "hello there,  we need a new site.  " };

  assert.equal(
    inquiryPayloadFingerprint(base),
    inquiryPayloadFingerprint(cosmetic),
    "whitespace and casing changes must not mint a fresh identity",
  );
  assert.notEqual(inquiryPayloadFingerprint(base), inquiryPayloadFingerprint({ ...base, message: "Different text." }));
  assert.notEqual(
    inquiryPayloadFingerprint(base),
    inquiryPayloadFingerprint({ ...base, slug: "john" }),
    "the same message to a different portfolio is a different event",
  );
  assert.match(inquiryPayloadFingerprint(base), /^[a-f0-9]{64}$/);
  assert.ok(!inquiryPayloadFingerprint(base).includes("Hello"), "the message must not be recoverable from the key");
});

/* --------------------------------------------------------------------- */
/* Lifecycle                                                             */
/* --------------------------------------------------------------------- */

test("status values are recognized, and nothing else is", () => {
  for (const status of INQUIRY_STATUSES) assert.equal(isInquiryStatus(status), true, status);
  for (const value of ["", "unread", "deleted", null, 3, {}]) assert.equal(isInquiryStatus(value), false, String(value));
});

test("reading an enquiry stamps a read time once and never moves it", () => {
  const firstRead = new Date("2026-08-17T09:00:00.000Z");
  const later = new Date("2026-08-18T09:00:00.000Z");

  const opened = inquiryStatusTransition("read", { status: "new", readAt: null, repliedAt: null }, firstRead);
  assert.equal(opened.status, "read");
  assert.equal(opened.readAt.toISOString(), firstRead.toISOString());

  const reopened = inquiryStatusTransition("read", { status: "read", readAt: firstRead, repliedAt: null }, later);
  assert.equal(reopened.readAt.toISOString(), firstRead.toISOString(), "re-reading must not restamp");
});

test("marking unread clears the read time so the badge agrees with the owner", () => {
  const transition = inquiryStatusTransition(
    "unread",
    { status: "read", readAt: new Date("2026-08-17T09:00:00.000Z"), repliedAt: null },
    new Date("2026-08-18T09:00:00.000Z"),
  );

  assert.equal(transition.status, "new");
  assert.equal(transition.readAt, null);
});

test("marking replied backfills a read time when the enquiry was never opened", () => {
  const now = new Date("2026-08-17T09:00:00.000Z");
  const transition = inquiryStatusTransition("replied", { status: "new", readAt: null, repliedAt: null }, now);

  assert.equal(transition.status, "replied");
  assert.equal(transition.readAt.toISOString(), now.toISOString());
  assert.equal(transition.repliedAt.toISOString(), now.toISOString());
});

test("archiving and spam are shelves that preserve what already happened", () => {
  const readAt = new Date("2026-08-15T09:00:00.000Z");
  const repliedAt = new Date("2026-08-16T09:00:00.000Z");
  const now = new Date("2026-08-17T09:00:00.000Z");

  const archived = inquiryStatusTransition("archived", { status: "replied", readAt, repliedAt }, now);
  assert.equal(archived.status, "archived");
  assert.equal(archived.readAt.toISOString(), readAt.toISOString());
  assert.equal(archived.archivedAt.toISOString(), now.toISOString());

  const spam = inquiryStatusTransition("spam", { status: "new", readAt: null, repliedAt: null }, now);
  assert.equal(spam.status, "spam");
  assert.equal(spam.archivedAt.toISOString(), now.toISOString());
});

test("restoring returns an enquiry to the furthest state it genuinely reached", () => {
  const readAt = new Date("2026-08-15T09:00:00.000Z");
  const repliedAt = new Date("2026-08-16T09:00:00.000Z");

  assert.equal(inquiryStatusTransition("restore", { status: "archived", readAt: null, repliedAt: null }).status, "new");
  assert.equal(inquiryStatusTransition("restore", { status: "archived", readAt, repliedAt: null }).status, "read");
  assert.equal(inquiryStatusTransition("restore", { status: "spam", readAt, repliedAt }).status, "replied");
  assert.equal(
    inquiryStatusTransition("restore", { status: "archived", readAt, repliedAt }).archivedAt,
    null,
    "restoring must clear the archive stamp",
  );
});

test("every transition resolves to a real status", () => {
  for (const action of ["read", "unread", "replied", "archived", "spam", "restore"]) {
    const transition = inquiryStatusTransition(action, { status: "new", readAt: null, repliedAt: null });
    assert.equal(isInquiryStatus(transition.status), true, action);
  }
});

/* --------------------------------------------------------------------- */
/* Presentation and paging                                               */
/* --------------------------------------------------------------------- */

test("excerpts collapse whitespace and stay short", () => {
  assert.equal(inquiryExcerpt("  Hello\n\n  there  "), "Hello there");

  const long = inquiryExcerpt("word ".repeat(200));
  assert.ok(long.length <= 180, `expected a trimmed excerpt, got ${long.length}`);
  assert.ok(long.endsWith("…"));
});

test("page size is clamped to a sane, bounded window", () => {
  assert.equal(parseInquiryPageSize(null), 20);
  assert.equal(parseInquiryPageSize("10"), 10);
  assert.equal(parseInquiryPageSize("500"), 50, "a caller cannot ask for an unbounded page");
  assert.equal(parseInquiryPageSize("0"), 20);
  assert.equal(parseInquiryPageSize("-5"), 20);
  assert.equal(parseInquiryPageSize("abc"), 20);
});
