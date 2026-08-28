import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-oauth-state-secret";

import { createGoogleLoginState, verifyGoogleLoginState } from "../../src/utils/googleAuth.ts";

test("a Google login state round-trips a safe next path", () => {
  const state = createGoogleLoginState("/calendar");
  assert.deepEqual(verifyGoogleLoginState(state), { next: "/calendar" });
});

test("an off-origin next path is dropped from Google login state", () => {
  const state = createGoogleLoginState("https://evil.example/phish");
  assert.deepEqual(verifyGoogleLoginState(state), { next: "" });
});

test("a tampered Google login state is rejected", () => {
  const state = createGoogleLoginState("/dashboard");
  const [, signature] = state.split(".");
  const tamperedPayload = Buffer.from(JSON.stringify({
    purpose: "google_login",
    next: "/dashboard",
    expiresAt: Date.now() + 60_000,
  })).toString("base64url");
  assert.equal(verifyGoogleLoginState(`${tamperedPayload}.${signature}`), null);
});

test("an expired Google login state is rejected", () => {
  const payload = Buffer.from(JSON.stringify({
    purpose: "google_login",
    next: "/dashboard",
    expiresAt: Date.now() - 60_000,
  })).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
  assert.equal(verifyGoogleLoginState(`${payload}.${signature}`), null);
});

test("a Calendar connector state is not accepted as Google login state", () => {
  const payload = Buffer.from(JSON.stringify({
    userId: "user-1",
    provider: "google",
    returnTo: "/calendar",
    expiresAt: Date.now() + 60_000,
  })).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
  assert.equal(verifyGoogleLoginState(`${payload}.${signature}`), null);
});
