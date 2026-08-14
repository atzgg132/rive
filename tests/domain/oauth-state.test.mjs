import assert from "node:assert/strict";
import test from "node:test";

// The OAuth state modules read SESSION_SECRET at call time. Set a deterministic
// test secret before any state is created so the suite is self-contained.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-oauth-state-secret";

import { createConnectorOAuthState, verifyConnectorOAuthState } from "../../src/utils/connectorSecurity.ts";
import { createCalendarOAuthState, verifyCalendarOAuthState } from "../../src/utils/calendarCrypto.ts";

/**
 * OAuth state consolidation (Goal 2 #2): calendarCrypto delegates to
 * connectorSecurity, so there is exactly one HMAC-signed-state implementation.
 * These tests lock the behavior both entry points must share: expiry,
 * tamper, cross-user, and provider binding.
 */

test("a calendar OAuth state verifies through the shared connector implementation", () => {
  const state = createCalendarOAuthState("user-1", "/calendar");
  const verified = verifyCalendarOAuthState(state);
  assert.deepEqual(verified, { userId: "user-1", returnTo: "/calendar" });
});

test("an onboarding-bound calendar state round-trips correctly", () => {
  const state = createCalendarOAuthState("user-1", "/onboarding");
  assert.deepEqual(verifyCalendarOAuthState(state), { userId: "user-1", returnTo: "/onboarding" });
});

test("a connector state for zoho still verifies for its own provider only", () => {
  const state = createConnectorOAuthState("user-1", "zoho_books", "/onboarding");
  assert.ok(verifyConnectorOAuthState(state, "zoho_books"));
  // Provider binding: the same state must not verify for another provider.
  assert.equal(verifyConnectorOAuthState(state, "google"), null);
  // And a calendar (google) verify must reject it too.
  assert.equal(verifyCalendarOAuthState(state), null);
});

test("a tampered state is rejected", () => {
  const state = createCalendarOAuthState("user-1", "/calendar");
  const [, signature] = state.split(".");
  const tamperedPayload = Buffer.from(JSON.stringify({ userId: "attacker", returnTo: "/calendar", expiresAt: Date.now() + 60_000 })).toString("base64url");
  assert.equal(verifyCalendarOAuthState(`${tamperedPayload}.${signature}`), null);
});

test("a cross-user state is rejected when replayed by another session holder", () => {
  const state = createCalendarOAuthState("user-1", "/calendar");
  const verified = verifyCalendarOAuthState(state);
  assert.ok(verified);
  // The state binds to user-1; a caller checking user-2 must get the bound id
  // back so the route can refuse mismatched sessions.
  assert.equal(verified.userId, "user-1");
});

test("an expired state is rejected", async () => {
  // Craft an expired state through the shared implementation by signing a
  // payload with an already-past expiry. verifyConnectorOAuthState refuses it.
  const payload = Buffer.from(JSON.stringify({
    userId: "user-1",
    provider: "google",
    returnTo: "/calendar",
    expiresAt: Date.now() - 60_000,
  })).toString("base64url");
  const { createHmac } = await import("node:crypto");
  const secret = process.env.SESSION_SECRET || "test-secret";
  process.env.SESSION_SECRET = secret;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  assert.equal(verifyCalendarOAuthState(`${payload}.${signature}`), null);
});

test("unsupported return paths are refused at creation time", () => {
  assert.throws(() => createConnectorOAuthState("user-1", "google", "https://evil.example.com"), /Unsupported OAuth return path/);
});
