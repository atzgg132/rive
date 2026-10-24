import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeReferralCode,
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CREDIT_CAP_MONTHS,
  referralCodeFromBytes,
  referralLink,
  referrerCreditMonths,
  summarizeReferralProgram,
} from "../../src/lib/referrals.ts";

test("issued codes are eight characters from the unambiguous alphabet", () => {
  const code = referralCodeFromBytes(Uint8Array.from({ length: 16 }, (_, index) => index * 37));
  assert.equal(code.length, 8);
  for (const character of code) assert.ok(REFERRAL_CODE_ALPHABET.includes(character));
  assert.throws(() => referralCodeFromBytes(new Uint8Array(4)));
});

test("only values shaped like an issued code are treated as referrals", () => {
  assert.equal(normalizeReferralCode("  AbCdEfGh "), "abcdefgh");
  assert.equal(normalizeReferralCode("newsletter"), null);
  assert.equal(normalizeReferralCode("abcdefg1"), null);
  assert.equal(normalizeReferralCode("abcdefgo"), null);
  assert.equal(normalizeReferralCode(""), null);
  assert.equal(normalizeReferralCode(undefined), null);
});

test("links point at registration with the code", () => {
  assert.equal(referralLink("https://rive.work/", "abcdefgh"), "https://rive.work/register?ref=abcdefgh");
});

test("referrer credit is one month per activated referral, capped at five", () => {
  assert.equal(REFERRAL_CREDIT_CAP_MONTHS, 5);
  assert.equal(referrerCreditMonths(0), 0);
  assert.equal(referrerCreditMonths(3), 3);
  assert.equal(referrerCreditMonths(9), 5);
  assert.equal(referrerCreditMonths(-2), 0);
});

test("admin totals count stamped or currently activated referrals and apply the cap per referrer", () => {
  const rows = [
    ...Array.from({ length: 7 }, (_, index) => ({ referrerId: "a", referredUserId: `a${index}`, activatedAt: new Date() })),
    { referrerId: "b", referredUserId: "b1", activatedAt: null },
    { referrerId: "b", referredUserId: "b2", activatedAt: null },
    { referrerId: "c", referredUserId: "c1", activatedAt: null },
  ];
  const totals = summarizeReferralProgram(rows, new Set(["b1"]));
  assert.deepEqual(totals, {
    referredSignups: 10,
    activatedReferrals: 8,
    referrers: 3,
    // Referrers: a capped at 5, b earns 1, c earns 0. Referred users: 8.
    creditMonths: 5 + 1 + 8,
  });
});
