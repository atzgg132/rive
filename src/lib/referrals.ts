/**
 * Referral programme rules shared by signup, Settings -> Referrals, and admin.
 *
 * During open beta there is no billing, so a referral earns launch credit:
 * free months applied once paid pricing launches. A referral earns only when
 * the referred account activates (docs/funnel-definitions.md). Each activated
 * referral earns one month for the referred user and one for the referrer, and
 * the referrer's total is capped.
 */
export const REFERRAL_CREDIT_CAP_MONTHS = 5;
export const REFERRED_USER_CREDIT_MONTHS = 1;

// Lowercase, no look-alike characters (0/o, 1/l/i), so a code read aloud or
// typed from a screenshot still resolves.
export const REFERRAL_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const REFERRAL_CODE_LENGTH = 8;

const CODE_PATTERN = new RegExp(`^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

/** Build a code from random bytes (one byte per character). */
export function referralCodeFromBytes(bytes: Uint8Array): string {
  if (bytes.length < REFERRAL_CODE_LENGTH) throw new Error("Not enough random bytes for a referral code.");
  let code = "";
  for (let index = 0; index < REFERRAL_CODE_LENGTH; index += 1) {
    code += REFERRAL_CODE_ALPHABET[bytes[index] % REFERRAL_CODE_ALPHABET.length];
  }
  return code;
}

/**
 * The `?ref=` value is free text shared with UTM-style campaign tags, so only
 * a value shaped like an issued code is looked up as a referral.
 */
export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/register?ref=${encodeURIComponent(code)}`;
}

export function referrerCreditMonths(activatedReferrals: number): number {
  return Math.min(Math.max(0, Math.floor(activatedReferrals)), REFERRAL_CREDIT_CAP_MONTHS);
}

export type ReferralProgramTotals = {
  referredSignups: number;
  activatedReferrals: number;
  referrers: number;
  /** Launch-credit months owed across both sides, after the referrer cap. */
  creditMonths: number;
};

/**
 * Admin totals. A referral counts as activated when it is stamped or when the
 * caller's activation pass already sees the referred account as activated, so
 * the count does not wait for either user to open Settings.
 */
export function summarizeReferralProgram(
  rows: Array<{ referrerId: string; referredUserId: string; activatedAt: Date | null }>,
  activatedUserIds: ReadonlySet<string>,
): ReferralProgramTotals {
  const activatedByReferrer = new Map<string, number>();
  let activatedReferrals = 0;
  for (const row of rows) {
    if (!activatedByReferrer.has(row.referrerId)) activatedByReferrer.set(row.referrerId, 0);
    if (!row.activatedAt && !activatedUserIds.has(row.referredUserId)) continue;
    activatedReferrals += 1;
    activatedByReferrer.set(row.referrerId, (activatedByReferrer.get(row.referrerId) || 0) + 1);
  }
  let referrerMonths = 0;
  for (const count of activatedByReferrer.values()) referrerMonths += referrerCreditMonths(count);
  return {
    referredSignups: rows.length,
    activatedReferrals,
    referrers: activatedByReferrer.size,
    creditMonths: referrerMonths + activatedReferrals * REFERRED_USER_CREDIT_MONTHS,
  };
}
