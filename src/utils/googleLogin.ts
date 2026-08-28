export const GOOGLE_LOGIN_ERROR_MESSAGES = {
  access_denied: "Google sign-in was cancelled.",
  not_configured: "Google sign-in is not available.",
  invalid_callback: "Google sign-in could not be completed. Try again.",
  email_unverified: "Google did not verify this email address.",
  account_conflict: "This Google account cannot be linked. Sign in with email instead.",
} as const;

export type GoogleLoginErrorCode = keyof typeof GOOGLE_LOGIN_ERROR_MESSAGES;

export function googleLoginErrorMessage(code: string | null | undefined): string {
  if (code && code in GOOGLE_LOGIN_ERROR_MESSAGES) {
    return GOOGLE_LOGIN_ERROR_MESSAGES[code as GoogleLoginErrorCode];
  }
  return GOOGLE_LOGIN_ERROR_MESSAGES.invalid_callback;
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
};

export type ExistingGoogleUser = {
  id: string;
  email: string;
  googleSubject: string | null;
};

export type GoogleLoginDecision =
  | { action: "login"; userId: string }
  | { action: "link"; userId: string }
  | { action: "create" }
  | { action: "reject"; reason: "email_unverified" | "account_conflict" };

export function decideGoogleLogin(
  identity: GoogleIdentity,
  bySubject: ExistingGoogleUser | null,
  byEmail: ExistingGoogleUser | null,
): GoogleLoginDecision {
  if (!identity.emailVerified) return { action: "reject", reason: "email_unverified" };
  if (bySubject) {
    if (byEmail && byEmail.id !== bySubject.id) return { action: "reject", reason: "account_conflict" };
    return { action: "login", userId: bySubject.id };
  }
  if (byEmail) {
    if (byEmail.googleSubject && byEmail.googleSubject !== identity.sub) {
      return { action: "reject", reason: "account_conflict" };
    }
    return { action: "link", userId: byEmail.id };
  }
  return { action: "create" };
}
