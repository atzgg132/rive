import assert from "node:assert/strict";
import test from "node:test";

import {
  SENSITIVE_ANALYTICS_PATHS,
  isSensitiveAnalyticsPath,
  sanitizeAnalyticsPath,
  sanitizeAnalyticsReferrer,
} from "../../src/lib/route-privacy.ts";
import { prisma } from "../helpers/module-loader.mjs";
import { NextRequest } from "../helpers/next-server-shim.mjs";

const { POST: trackPost } = await import("../../src/app/api/track/route.ts");

const TOKEN_SECRET = "raw-token-material";
const REFERRER_SECRET = "raw-referrer-material";

function postTrack(body) {
  const created = [];
  prisma.pageView = {
    async create({ data }) {
      created.push(data);
      return data;
    },
  };
  prisma.productEvent = {
    async create({ data }) {
      return data;
    },
  };
  const request = new NextRequest("http://localhost/api/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return trackPost(request).then((response) => ({ response, created }));
}

test("token routes collapse to their templates, including trailing segments", () => {
  const cases = [
    [`/sign/${TOKEN_SECRET}`, "/sign/[token]"],
    [`/sign/${TOKEN_SECRET}/nested/deeper`, "/sign/[token]"],
    [`/review/${TOKEN_SECRET}`, "/review/[token]"],
    [`/review/${TOKEN_SECRET}/more`, "/review/[token]"],
    [`/invoice/${TOKEN_SECRET}`, "/invoice/[token]"],
    [`/api/public/invoices/${TOKEN_SECRET}`, "/api/public/invoices/[token]"],
    [`/api/public/invoices/${TOKEN_SECRET}/events`, "/api/public/invoices/[token]"],
    [`/api/public/contracts/review/${TOKEN_SECRET}`, "/api/public/contracts/review/[token]"],
    [`/api/public/contracts/sign/${TOKEN_SECRET}`, "/api/public/contracts/sign/[token]"],
    [`/api/public/contracts/sign/${TOKEN_SECRET}/artifact`, "/api/public/contracts/sign/[token]"],
    [`/api/public/contracts/artifact/${TOKEN_SECRET}`, "/api/public/contracts/artifact/[token]"],
    [`/api/public/contracts/void/${TOKEN_SECRET}`, "/api/public/contracts/void/[token]"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(sanitizeAnalyticsPath(input), expected);
  }
});

test("a sensitive prefix followed by a slash always yields the template", () => {
  assert.equal(sanitizeAnalyticsPath("/sign/"), "/sign/[token]");
  assert.equal(sanitizeAnalyticsPath(`/sign//${TOKEN_SECRET}`), "/sign/[token]");
  assert.equal(sanitizeAnalyticsPath("/sign//"), "/sign/[token]");
  assert.equal(sanitizeAnalyticsPath("/api/public/invoices/"), "/api/public/invoices/[token]");
  assert.equal(sanitizeAnalyticsPath(`/api/public/contracts/sign//${TOKEN_SECRET}`), "/api/public/contracts/sign/[token]");
  assert.equal(sanitizeAnalyticsPath("/api/public/contracts/void//"), "/api/public/contracts/void/[token]");
});

test("bare sensitive bases without a trailing slash stay unchanged", () => {
  assert.equal(sanitizeAnalyticsPath("/sign"), "/sign");
  assert.equal(sanitizeAnalyticsPath("/review"), "/review");
  assert.equal(sanitizeAnalyticsPath("/invoice"), "/invoice");
  assert.equal(sanitizeAnalyticsPath("/api/public/invoices"), "/api/public/invoices");
  assert.equal(sanitizeAnalyticsPath("/api/public/contracts/sign"), "/api/public/contracts/sign");
  assert.equal(sanitizeAnalyticsPath("/api/public/contracts/void"), "/api/public/contracts/void");
});

test("sensitive prefixes require the exact base segment boundary", () => {
  assert.equal(sanitizeAnalyticsPath(`/signature/${TOKEN_SECRET}`), `/signature/${TOKEN_SECRET}`);
  assert.equal(sanitizeAnalyticsPath(`/api/public/contracts/${TOKEN_SECRET}`), `/api/public/contracts/${TOKEN_SECRET}`);
});

test("percent-encoded token text maps to the template without being decoded", () => {
  const encoded = `/sign/${encodeURIComponent(TOKEN_SECRET)}%2F%73%65%63%72%65%74`;
  const result = sanitizeAnalyticsPath(encoded);
  assert.equal(result, "/sign/[token]");
  assert.equal(result.includes(TOKEN_SECRET), false);
  assert.equal(result.includes("secret"), false);
  assert.equal(sanitizeAnalyticsPath("/sign/%2F"), "/sign/[token]");
});

test("query and hash are discarded on every path shape", () => {
  assert.equal(sanitizeAnalyticsPath(`/sign/${TOKEN_SECRET}?utm_source=test#frag`), "/sign/[token]");
  assert.equal(sanitizeAnalyticsPath("/pricing?utm_medium=cpc&x=1#section"), "/pricing");
  assert.equal(sanitizeAnalyticsPath("/?x=1"), "/");
});

test("ordinary paths keep their parsed pathname", () => {
  assert.equal(sanitizeAnalyticsPath("/pricing"), "/pricing");
  assert.equal(sanitizeAnalyticsPath("/workflow/invoices/new"), "/workflow/invoices/new");
  assert.equal(sanitizeAnalyticsPath("/"), "/");
  for (const template of SENSITIVE_ANALYTICS_PATHS) {
    assert.equal(sanitizeAnalyticsPath(template), template);
  }
});

test("non-path and non-string input collapses to the root path", () => {
  for (const value of [undefined, null, 0, 42, {}, [], "", "sign/token", "relative/path"]) {
    assert.equal(sanitizeAnalyticsPath(value), "/");
  }
});

test("absolute URLs and protocol-relative or backslash forms are rejected", () => {
  assert.equal(sanitizeAnalyticsPath(`https://evil.example/sign/${TOKEN_SECRET}`), "/");
  assert.equal(sanitizeAnalyticsPath(`//evil.example/sign/${TOKEN_SECRET}`), "/");
  assert.equal(sanitizeAnalyticsPath("/\\evil.example/sign/x"), "/");
  assert.equal(sanitizeAnalyticsPath("javascript:alert(1)"), "/");
  assert.equal(sanitizeAnalyticsPath("file:///etc/passwd"), "/");
});

test("output is capped at 500 characters", () => {
  const long = `/docs/${"a".repeat(600)}`;
  assert.equal(sanitizeAnalyticsPath(long).length, 500);
});

test("referrers keep only protocol, hostname, and a sanitized path", () => {
  assert.equal(
    sanitizeAnalyticsReferrer(`https://user:pass@example.com:8443/review/${REFERRER_SECRET}?q=1#frag`),
    "https://example.com/review/[token]",
  );
  assert.equal(
    sanitizeAnalyticsReferrer(`http://localhost:3000/invoice/${REFERRER_SECRET}?utm_source=x`),
    "http://localhost/invoice/[token]",
  );
  assert.equal(
    sanitizeAnalyticsReferrer("https://app.rive.work/pricing?utm_campaign=launch"),
    "https://app.rive.work/pricing",
  );
  const capped = sanitizeAnalyticsReferrer(`https://example.com/${"a".repeat(600)}`);
  assert.equal(capped.length, 500);
});

test("a same-host referrer stays same-host after sanitization drops the port", () => {
  const sanitized = sanitizeAnalyticsReferrer(`http://localhost:3000/review/${REFERRER_SECRET}?x=1`);
  assert.equal(sanitized, "http://localhost/review/[token]");
  assert.equal(new URL(sanitized).hostname !== "localhost", false);
});

test("non-http referrers, relative values, and non-strings are rejected", () => {
  for (const value of [
    `ftp://example.com/sign/${REFERRER_SECRET}`,
    "javascript:alert(1)",
    "mailto:someone@example.com",
    `data:text/html,/sign/${REFERRER_SECRET}`,
    "/review/relative",
    "not a url",
    "",
    undefined,
    null,
    42,
    {},
  ]) {
    assert.equal(sanitizeAnalyticsReferrer(value), null);
  }
});

test("isSensitiveAnalyticsPath flags only paths that sanitize to a template", () => {
  for (const template of SENSITIVE_ANALYTICS_PATHS) {
    assert.equal(isSensitiveAnalyticsPath(template), true);
  }
  assert.equal(isSensitiveAnalyticsPath(`/sign/${TOKEN_SECRET}`), true);
  assert.equal(isSensitiveAnalyticsPath("/sign/"), true);
  assert.equal(isSensitiveAnalyticsPath("/sign//nested"), true);
  assert.equal(isSensitiveAnalyticsPath(`/api/public/contracts/void/${TOKEN_SECRET}?x=1`), true);
  assert.equal(isSensitiveAnalyticsPath("/sign"), false);
  assert.equal(isSensitiveAnalyticsPath("/api/public/contracts/sign"), false);
  assert.equal(isSensitiveAnalyticsPath("/pricing"), false);
  assert.equal(isSensitiveAnalyticsPath(`https://evil.example/sign/${TOKEN_SECRET}`), false);
  assert.equal(isSensitiveAnalyticsPath(undefined), false);
});

test("a forged POST to /api/track persists only sanitized values", async () => {
  const { response, created } = await postTrack({
    path: `/sign/${TOKEN_SECRET}?utm_source=forge`,
    referrer: `https://user:pass@example.com:8443/review/${REFERRER_SECRET}?x=1#frag`,
    landingPage: `/invoice/${TOKEN_SECRET}?note=1`,
  });
  assert.equal(response.status, 200);
  assert.equal(created.length, 1);
  const persisted = created[0];
  assert.equal(persisted.path, "/sign/[token]");
  assert.equal(persisted.landingPath, "/invoice/[token]");
  assert.equal(persisted.referrer, "https://example.com/review/[token]");
  assert.equal(persisted.referrerDomain, "example.com");
  const serialized = JSON.stringify(persisted);
  assert.equal(serialized.includes(TOKEN_SECRET), false);
  assert.equal(serialized.includes(REFERRER_SECRET), false);
  assert.equal(serialized.includes("utm_source"), false);
});

test("a forged POST with empty or repeated-slash tokens still persists the template", async () => {
  const { response, created } = await postTrack({
    path: `/sign//${TOKEN_SECRET}`,
    referrer: `https://example.com/review//${REFERRER_SECRET}`,
    landingPage: "/api/public/contracts/void//",
  });
  assert.equal(response.status, 200);
  assert.equal(created.length, 1);
  const persisted = created[0];
  assert.equal(persisted.path, "/sign/[token]");
  assert.equal(persisted.landingPath, "/api/public/contracts/void/[token]");
  assert.equal(persisted.referrer, "https://example.com/review/[token]");
  const serialized = JSON.stringify(persisted);
  assert.equal(serialized.includes(TOKEN_SECRET), false);
  assert.equal(serialized.includes(REFERRER_SECRET), false);
});

test("a forged POST with non-string fields falls back to safe defaults", async () => {
  const { response, created } = await postTrack({
    path: `//evil.example/sign/${TOKEN_SECRET}`,
    referrer: "javascript:alert(1)",
    landingPage: 42,
  });
  assert.equal(response.status, 200);
  assert.equal(created.length, 1);
  const persisted = created[0];
  assert.equal(persisted.path, "/");
  assert.equal(persisted.landingPath, "/");
  assert.equal(persisted.referrer, null);
  assert.equal(persisted.referrerDomain, null);
});
