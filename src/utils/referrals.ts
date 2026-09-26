import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { funnelSummaryForUser, loadWorkspaceSlices } from "@/utils/adminFunnelFacts";
import {
  normalizeReferralCode,
  REFERRAL_CREDIT_CAP_MONTHS,
  REFERRED_USER_CREDIT_MONTHS,
  referralCodeFromBytes,
  referrerCreditMonths,
} from "@/lib/referrals";

type Client = typeof prisma | Prisma.TransactionClient;

/**
 * Link a brand-new account to the user whose referral code it arrived with.
 * Runs inside the signup transaction; the unique `referredUserId` means an
 * account is credited to one referrer, once. Unknown codes are ignored so a
 * stale or mistyped link never blocks signup.
 */
export async function recordReferralAtSignup(
  client: Client,
  input: { userId: string; referralSource: string | null | undefined },
): Promise<void> {
  const code = normalizeReferralCode(input.referralSource);
  if (!code) return;
  const referrer = await client.user.findUnique({ where: { referralCode: code }, select: { id: true } });
  if (!referrer || referrer.id === input.userId) return;
  await client.referral.create({ data: { referrerId: referrer.id, referredUserId: input.userId, code } });
}

/** The user's referral code, issued on first request. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (existing?.referralCode) return existing.referralCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = referralCodeFromBytes(randomBytes(16));
    try {
      // Only fill an empty code, so two concurrent first loads cannot swap it.
      const updated = await prisma.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } });
      if (updated.count === 0) break;
      return code;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (!current?.referralCode) throw new Error("Referral code could not be issued.");
  return current.referralCode;
}

/**
 * Stamp `activatedAt` on referrals whose referred account now meets the
 * activated-user definition. Activation is judged on the first seven days
 * after signup, so once stamped the credit is kept even if records are later
 * removed.
 */
export async function refreshReferralActivation(referredUserIds: string[]): Promise<void> {
  if (referredUserIds.length === 0) return;
  const users = await prisma.user.findMany({
    where: { id: { in: referredUserIds }, referredBy: { activatedAt: null } },
    select: {
      id: true,
      createdAt: true,
      accountType: true,
      emailVerifiedAt: true,
      emailVerificationRequiredAt: true,
      onboardingStatus: true,
      businessType: true,
      profession: true,
      onboardingData: true,
      attribution: { select: { firstTouchSource: true, lastTouchSource: true, referralSource: true } },
    },
  });
  if (users.length === 0) return;
  const slices = await loadWorkspaceSlices(users.map((user) => user.id));
  const activatedIds = users
    .filter((user) => funnelSummaryForUser(user, slices.get(user.id)!).activated)
    .map((user) => user.id);
  if (activatedIds.length === 0) return;
  await prisma.referral.updateMany({
    where: { referredUserId: { in: activatedIds }, activatedAt: null },
    data: { activatedAt: new Date() },
  });
}

export type ReferralSummary = {
  code: string;
  joined: number;
  activated: number;
  monthsEarned: number;
  monthsCap: number;
  referredBy: { activated: boolean; months: number } | null;
};

export async function getReferralSummary(userId: string): Promise<ReferralSummary> {
  const code = await ensureReferralCode(userId);
  const [made, own] = await Promise.all([
    prisma.referral.findMany({ where: { referrerId: userId }, select: { referredUserId: true, activatedAt: true } }),
    prisma.referral.findUnique({ where: { referredUserId: userId }, select: { referredUserId: true, activatedAt: true } }),
  ]);
  const pending = [...made, ...(own ? [own] : [])].filter((row) => !row.activatedAt).map((row) => row.referredUserId);
  await refreshReferralActivation(pending);
  const [activated, ownAfter] = pending.length > 0
    ? await Promise.all([
        prisma.referral.count({ where: { referrerId: userId, activatedAt: { not: null } } }),
        own ? prisma.referral.findUnique({ where: { referredUserId: userId }, select: { activatedAt: true } }) : null,
      ])
    : [made.filter((row) => row.activatedAt).length, own];
  const ownActivated = Boolean(ownAfter?.activatedAt);
  return {
    code,
    joined: made.length,
    activated,
    monthsEarned: referrerCreditMonths(activated),
    monthsCap: REFERRAL_CREDIT_CAP_MONTHS,
    referredBy: own ? { activated: ownActivated, months: ownActivated ? REFERRED_USER_CREDIT_MONTHS : 0 } : null,
  };
}
