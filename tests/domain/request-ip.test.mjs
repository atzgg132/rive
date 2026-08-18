import assert from "node:assert/strict";
import test from "node:test";

import { getRequestIp } from "../../src/utils/rateLimit.ts";

/**
 * The client address is the key for every IP-scoped rate limit and for the
 * hashed addresses stored on audit and signature records. If a caller can
 * choose it, none of those bound anything: a fresh value allocates a fresh
 * bucket. These tests pin the one property that matters — the value is read
 * from the right-hand end of the chain, which is the end the caller cannot
 * push entries past.
 */

function request(headers) {
  return new Request("https://www.rive.work/api/anything", { headers });
}

test("reads the hop the proxy appended, not the one the caller sent", () => {
  // Caddy appends the socket peer, so a forged prefix stays to the left.
  assert.equal(
    getRequestIp(request({ "x-forwarded-for": "10.0.0.1, 203.0.113.7" })),
    "203.0.113.7",
  );
});

test("a forged chain of any length cannot shift the answer", () => {
  const forged = Array.from({ length: 50 }, (_, index) => `10.0.0.${index + 1}`).join(", ");
  assert.equal(
    getRequestIp(request({ "x-forwarded-for": `${forged}, 198.51.100.4` })),
    "198.51.100.4",
  );
});

test("a single-entry header is the proxy's own value", () => {
  assert.equal(getRequestIp(request({ "x-forwarded-for": "203.0.113.7" })), "203.0.113.7");
});

test("unparseable entries are dropped rather than used as a bucket key", () => {
  // Without this, the caller controls both the key and its length.
  assert.equal(
    getRequestIp(request({ "x-forwarded-for": "not-an-ip, ${jndi:ldap://x}, 203.0.113.9" })),
    "203.0.113.9",
  );
  assert.equal(getRequestIp(request({ "x-forwarded-for": "not-an-ip" })), "unknown");
  assert.equal(getRequestIp(request({ "x-forwarded-for": "a".repeat(500) })), "unknown");
});

test("octet ranges are enforced so near-misses do not become distinct keys", () => {
  assert.equal(getRequestIp(request({ "x-forwarded-for": "999.1.1.1" })), "unknown");
  assert.equal(getRequestIp(request({ "x-forwarded-for": "203.0.113.255" })), "203.0.113.255");
});

test("ports are stripped so one client cannot spread across buckets", () => {
  assert.equal(getRequestIp(request({ "x-forwarded-for": "203.0.113.7:52001" })), "203.0.113.7");
  assert.equal(getRequestIp(request({ "x-forwarded-for": "[2001:db8::1]:443" })), "2001:db8::1");
});

test("IPv6 survives normalization and stays case-stable", () => {
  assert.equal(getRequestIp(request({ "x-forwarded-for": "2001:DB8::1" })), "2001:db8::1");
});

test("falls back to x-real-ip, then to a constant, and never to raw input", () => {
  assert.equal(getRequestIp(request({ "x-real-ip": "203.0.113.7" })), "203.0.113.7");
  assert.equal(getRequestIp(request({ "x-real-ip": "garbage" })), "unknown");
  assert.equal(getRequestIp(request({})), "unknown");
});

test("an empty or whitespace-only header does not yield an empty key", () => {
  assert.equal(getRequestIp(request({ "x-forwarded-for": "" })), "unknown");
  assert.equal(getRequestIp(request({ "x-forwarded-for": " , , " })), "unknown");
});
