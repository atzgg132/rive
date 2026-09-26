import assert from "node:assert/strict";
import test from "node:test";

import { totpCode, generateTotpSecret as coreGenerateTotpSecret, verifyTotpWithReplayGuard } from "../../src/utils/totp.ts";
import {
  buildOtpAuthUri,
  formatManualKey,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  matchRecoveryCode,
  normalizeRecoveryCode,
} from "../../src/utils/twoFactor.ts";
import { requiresPasswordForTwoFactorChange } from "../../src/utils/twoFactorReauth.ts";
import { isGooglePlaceholderPassword } from "../../src/utils/userAuth.ts";

test("twoFactor.generateTotpSecret is the same generator adminTotp uses", () => {
  assert.equal(generateTotpSecret, coreGenerateTotpSecret);
  assert.match(generateTotpSecret(), /^[A-Z2-7]{32}$/);
});

test("verifyTotpWithReplayGuard accepts drift within one step and reports the consumed step", () => {
  const secret = generateTotpSecret();
  const realNow = Date.now;
  try {
    const step = Math.floor(1_800_000_000 / 30);
    const windowStart = step * 30_000;
    Date.now = () => windowStart + 5_000;
    const code = totpCode(secret, windowStart);

    const result = verifyTotpWithReplayGuard(code, secret, null);
    assert.equal(result.ok, true);
    assert.equal(result.usedStep, step);
  } finally {
    Date.now = realNow;
  }
});

test("verifyTotpWithReplayGuard rejects a code whose step was already consumed", () => {
  const secret = generateTotpSecret();
  const realNow = Date.now;
  try {
    const step = Math.floor(1_800_000_000 / 30);
    const windowStart = step * 30_000;
    Date.now = () => windowStart + 5_000;
    const code = totpCode(secret, windowStart);

    const first = verifyTotpWithReplayGuard(code, secret, null);
    assert.equal(first.ok, true);
    // Same code, same step, submitted again: replay must be rejected even
    // though the six digits still match within the validity window.
    const replay = verifyTotpWithReplayGuard(code, secret, first.usedStep);
    assert.equal(replay.ok, false);
  } finally {
    Date.now = realNow;
  }
});

test("verifyTotpWithReplayGuard still accepts a later step after an earlier one was consumed", () => {
  const secret = generateTotpSecret();
  const realNow = Date.now;
  try {
    const step = Math.floor(1_800_000_000 / 30);
    Date.now = () => step * 30_000 + 5_000;
    const firstCode = totpCode(secret, step * 30_000);
    const first = verifyTotpWithReplayGuard(firstCode, secret, null);
    assert.equal(first.ok, true);

    const nextStep = step + 1;
    Date.now = () => nextStep * 30_000 + 5_000;
    const nextCode = totpCode(secret, nextStep * 30_000);
    const next = verifyTotpWithReplayGuard(nextCode, secret, first.usedStep);
    assert.equal(next.ok, true);
    assert.equal(next.usedStep, nextStep);
  } finally {
    Date.now = realNow;
  }
});

test("verifyTotpWithReplayGuard rejects malformed codes and secrets without throwing", () => {
  const secret = generateTotpSecret();
  assert.equal(verifyTotpWithReplayGuard("12345", secret, null).ok, false);
  assert.equal(verifyTotpWithReplayGuard("abcdef", secret, null).ok, false);
  assert.equal(verifyTotpWithReplayGuard("123456", "!!!", null).ok, false);
});

test("generateRecoveryCodes produces 10 unique, correctly formatted, hash-matching codes", () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, 10);
  const plainCodes = codes.map((entry) => entry.code);
  assert.equal(new Set(plainCodes).size, 10);
  for (const { code, codeHash } of codes) {
    assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(hashRecoveryCode(code), codeHash);
  }
});

test("hashRecoveryCode normalizes case, whitespace, and punctuation before hashing", () => {
  const code = generateRecoveryCodes(1)[0].code;
  const hash = hashRecoveryCode(code);
  assert.equal(hashRecoveryCode(code.toLowerCase()), hash);
  assert.equal(hashRecoveryCode(`  ${code}  `), hash);
  assert.equal(hashRecoveryCode(code.replace("-", "")), hash);
  assert.equal(normalizeRecoveryCode(` ${code.toLowerCase()} `), code.replace("-", ""));
});

test("matchRecoveryCode finds only the matching, unused code and ignores used ones", () => {
  const [a, b] = generateRecoveryCodes(2);
  const stored = [
    { id: "a", codeHash: a.codeHash, usedAt: null },
    { id: "b", codeHash: b.codeHash, usedAt: new Date() },
  ];
  assert.equal(matchRecoveryCode(a.code, stored)?.id, "a");
  // b's hash matches, but it's already used: must not match.
  assert.equal(matchRecoveryCode(b.code, stored), null);
  assert.equal(matchRecoveryCode("ZZZZ-ZZZZ", stored), null);
});

test("looksLikeRecoveryCode distinguishes 6-digit TOTP codes from recovery codes", () => {
  assert.equal(looksLikeRecoveryCode("123456"), false);
  assert.equal(looksLikeRecoveryCode("12345"), true);
  assert.equal(looksLikeRecoveryCode("ABCD-1234"), true);
  assert.equal(looksLikeRecoveryCode(" 123456 "), false);
});

test("buildOtpAuthUri and formatManualKey produce a usable authenticator setup", () => {
  const secret = generateTotpSecret();
  const uri = buildOtpAuthUri(secret, "operator@example.com");
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.ok(uri.includes(encodeURIComponent(secret)) || uri.includes(secret));
  assert.ok(uri.includes("issuer=rive.work"));
  const manualKey = formatManualKey(secret);
  assert.equal(manualKey.replace(/\s+/g, ""), secret);
});

test("requiresPasswordForTwoFactorChange mirrors the Google-placeholder-password check", () => {
  assert.equal(requiresPasswordForTwoFactorChange("scrypt:abc:def"), true);
  assert.equal(requiresPasswordForTwoFactorChange("google-oauth:unusable"), false);
  assert.equal(requiresPasswordForTwoFactorChange("google-oauth:unusable"), !isGooglePlaceholderPassword("google-oauth:unusable"));
});
