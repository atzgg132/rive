// RFC 6238 TOTP for the admin login second factor.
//
// Deliberately free of `server-only` and `next/server` imports so the
// verification contract can be asserted directly in the no-DB domain tests —
// the same reason adminSessionCookie.ts stays dependency-free. Only the login
// route imports this; the secret never leaves the server.
//
// The RFC 6238 primitives themselves live in totp.ts, generalised for reuse
// by workspace-user two-factor auth (see twoFactor.ts). This module re-exports
// them unchanged so existing imports and tests keep working, and adds only
// the admin-specific production gate below.
export {
  base32Encode,
  generateTotpSecret,
  totpCode,
  verifyTotp,
  isUsableTotpSecret,
} from "@/utils/totp";
import { isUsableTotpSecret } from "@/utils/totp";

// The admin account is a single set of keys to every tenant, so in the real
// production environments a missing second factor must close the login route
// rather than degrade to password-only.
const PRODUCTION_ADMIN_ENVIRONMENTS: ReadonlySet<string> = new Set(["prod", "production"]);

export function isProductionAdminEnvironment(appEnv: string | null | undefined): boolean {
  return PRODUCTION_ADMIN_ENVIRONMENTS.has((appEnv ?? "").trim().toLowerCase());
}

/**
 * The login gate for the second factor.
 *
 * - `not_required` — no secret provisioned outside production; password-only
 *   is the intended local/dev/test behaviour.
 * - `required` — a usable secret exists; the code must verify.
 * - `unavailable` — the environment requires TOTP or a secret is configured,
 *   but the configured value cannot decode. Login must fail closed.
 */
export type AdminTotpGate = "not_required" | "required" | "unavailable";

export function adminTotpGate(
  appEnv: string | null | undefined,
  secretBase32: string | null | undefined,
): AdminTotpGate {
  if (!isProductionAdminEnvironment(appEnv) && !secretBase32?.trim()) return "not_required";
  return isUsableTotpSecret(secretBase32) ? "required" : "unavailable";
}
