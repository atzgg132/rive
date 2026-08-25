/**
 * Grandfathered accounts never had verification required; everyone who signed
 * up after it shipped must complete it. Login, sessions, and password-reset
 * mail all use this same rule so an unverified address cannot be used as a
 * bounce target via forgot-password.
 */
export function isEmailVerificationSatisfied(user: {
  emailVerifiedAt: Date | null;
  emailVerificationRequiredAt: Date | null;
}): boolean {
  return !user.emailVerificationRequiredAt || Boolean(user.emailVerifiedAt);
}
