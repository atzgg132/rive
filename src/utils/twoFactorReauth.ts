import "server-only";

import { isGooglePlaceholderPassword, verifyPassword } from "@/utils/userAuth";
import { consumeTwoFactorCode } from "@/utils/twoFactorVerification";

/**
 * True when the account has a real password and must supply it to
 * disable 2FA or regenerate recovery codes. A Google-only account has no
 * password to check (the stored hash is an unusable placeholder), so a
 * current 2FA code stands in as the credential proof instead.
 */
export function requiresPasswordForTwoFactorChange(passwordHash: string): boolean {
  return !isGooglePlaceholderPassword(passwordHash);
}

export type TwoFactorReauthUser = {
  id: string;
  passwordHash: string;
  twoFactorSecretEncrypted: string;
  twoFactorLastUsedStep: number | null;
};

export type TwoFactorReauthResult = { ok: true } | { ok: false; message: string };

/**
 * Re-authorizes a security-sensitive 2FA change (disable, regenerate codes):
 * the current password when the account has one, always plus a current
 * TOTP or recovery code. For a Google-only account (no password), the code
 * alone satisfies both — see requiresPasswordForTwoFactorChange.
 */
export async function verifyTwoFactorReauth(
  user: TwoFactorReauthUser,
  input: { password?: string; code?: string },
): Promise<TwoFactorReauthResult> {
  if (requiresPasswordForTwoFactorChange(user.passwordHash)) {
    if (!input.password || !verifyPassword(input.password, user.passwordHash)) {
      return { ok: false, message: "Enter your current password." };
    }
  }
  if (!input.code) {
    return { ok: false, message: "Enter a current authenticator or recovery code." };
  }
  const verified = await consumeTwoFactorCode(
    { id: user.id, twoFactorSecretEncrypted: user.twoFactorSecretEncrypted, twoFactorLastUsedStep: user.twoFactorLastUsedStep },
    input.code,
  );
  if (!verified) {
    return { ok: false, message: "That code is not valid or has already been used." };
  }
  return { ok: true };
}
