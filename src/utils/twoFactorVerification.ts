import "server-only";

import { prisma } from "@/utils/db";
import { decryptTwoFactorSecret, looksLikeRecoveryCode, matchRecoveryCode, verifyTotpWithReplayGuard } from "@/utils/twoFactor";

/**
 * Verifies a submitted TOTP or recovery code against a user's enrolled 2FA,
 * with the DB side effects a successful check requires: advancing the replay
 * guard for a TOTP code, or marking a recovery code single-use. Shared by the
 * login second step and every authenticated re-auth check (disable,
 * regenerate codes) so there is exactly one place that can accept a code.
 */
export async function consumeTwoFactorCode(
  user: { id: string; twoFactorSecretEncrypted: string; twoFactorLastUsedStep: number | null },
  code: string,
): Promise<boolean> {
  if (looksLikeRecoveryCode(code)) {
    const storedCodes = await prisma.twoFactorRecoveryCode.findMany({
      where: { userId: user.id, usedAt: null },
      select: { id: true, codeHash: true, usedAt: true },
    });
    const match = matchRecoveryCode(code, storedCodes);
    if (!match) return false;
    const claimed = await prisma.twoFactorRecoveryCode.updateMany({
      where: { id: match.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return claimed.count === 1;
  }

  const secret = await decryptTwoFactorSecret(user.twoFactorSecretEncrypted);
  const result = verifyTotpWithReplayGuard(code, secret, user.twoFactorLastUsedStep);
  if (!result.ok) return false;
  // Optimistic: only advances the guard if nothing else already moved it,
  // so two concurrent submissions of the same code can't both be accepted.
  const advanced = await prisma.user.updateMany({
    where: { id: user.id, twoFactorLastUsedStep: user.twoFactorLastUsedStep ?? null },
    data: { twoFactorLastUsedStep: result.usedStep },
  });
  return advanced.count === 1;
}
