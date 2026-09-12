import assert from "node:assert/strict";
import test from "node:test";

import {
  base32Encode,
  generateTotpSecret,
  totpCode,
  verifyTotp,
} from "../../src/utils/adminTotp.ts";

// RFC 6238 Appendix B test secret: "12345678901234567890" in ASCII. The 8-digit
// SHA-1 vectors published there truncated to six digits pin this implementation
// to the real standard instead of to itself.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("totpCode matches the RFC 6238 SHA-1 vectors truncated to six digits", () => {
  assert.equal(totpCode(RFC_SECRET, 59_000), "287082"); // 94287082
  assert.equal(totpCode(RFC_SECRET, 1_111_111_109_000), "081804"); // 07081804
  // Leading zero must survive padStart.
  assert.equal(totpCode(RFC_SECRET, 1_234_567_890_000), "005924"); // 89005924
});

test("generateTotpSecret produces a 160-bit base32 seed", () => {
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  // 20 bytes -> 32 base32 characters with no padding.
  assert.equal(base32Encode(Buffer.alloc(20)).length, 32);
});

test("totpCode rejects secrets that are not valid base32", () => {
  assert.equal(totpCode("not-a-real-secret!!!", 59_000), null);
  assert.equal(totpCode("", 59_000), null);
});

test("verifyTotp accepts the current step and one step of clock drift", () => {
  const secret = generateTotpSecret();
  const realNow = Date.now;
  try {
    const step = Math.floor(1700000000 / 30);
    const windowStart = step * 30_000;
    Date.now = () => windowStart + 5_000;
    const expected = totpCode(secret, windowStart);

    assert.equal(verifyTotp(expected, secret), true);
    // One 30s step either side absorbs authenticator skew.
    assert.equal(verifyTotp(totpCode(secret, windowStart - 30_000), secret), true);
    assert.equal(verifyTotp(totpCode(secret, windowStart + 30_000), secret), true);
    // Two steps away is outside the window.
    assert.equal(verifyTotp(totpCode(secret, windowStart + 60_000), secret), false);
    // A wrong code at the right time still fails.
    const wrong = expected === "000000" ? "000001" : "000000";
    assert.equal(verifyTotp(wrong, secret), false);
  } finally {
    Date.now = realNow;
  }
});

test("verifyTotp rejects malformed codes and secrets without throwing", () => {
  const secret = generateTotpSecret();
  assert.equal(verifyTotp("12345", secret), false);
  assert.equal(verifyTotp("1234567", secret), false);
  assert.equal(verifyTotp("abcdef", secret), false);
  assert.equal(verifyTotp("", secret), false);
  assert.equal(verifyTotp("123456", "!!!"), false);
});
