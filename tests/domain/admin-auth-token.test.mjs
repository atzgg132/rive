import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

// The legacy admin token exists for local scripts and the E2E fixture. Its key
// must come from ADMIN_TOKEN_SECRET — a database URL is not a signing secret —
// and the signature compare must be timing-safe. These tests pin both halves.
process.env.ADMIN_TOKEN_SECRET = "test-admin-token-secret";
const { generateToken, verifyToken } = await import("../../src/utils/auth.ts");

function signedToken(expiry, secret = "test-admin-token-secret") {
  const signature = crypto.createHmac("sha256", secret).update(String(expiry)).digest("hex");
  return Buffer.from(`${expiry}:${signature}`).toString("base64");
}

test("a freshly generated token verifies", () => {
  assert.equal(verifyToken(generateToken()), true);
});

test("a token signed with a different secret is rejected", () => {
  const token = signedToken(Date.now() + 60_000, "attacker-controlled-secret");
  assert.equal(verifyToken(token), false);
});

test("an expired token is rejected even with a valid signature", () => {
  const token = signedToken(Date.now() - 1_000);
  assert.equal(verifyToken(token), false);
});

test("tampering with the signature is rejected", () => {
  const expiry = Date.now() + 60_000;
  const signature = crypto.createHmac("sha256", "test-admin-token-secret").update(String(expiry)).digest("hex");
  const tampered = signature.slice(0, -1) + (signature.endsWith("0") ? "1" : "0");
  assert.equal(verifyToken(Buffer.from(`${expiry}:${tampered}`).toString("base64")), false);
});

test("malformed input is rejected without throwing", () => {
  assert.equal(verifyToken(null), false);
  assert.equal(verifyToken(""), false);
  assert.equal(verifyToken("not-base64!!!"), false);
  assert.equal(verifyToken(Buffer.from("no-colon-here").toString("base64")), false);
});
