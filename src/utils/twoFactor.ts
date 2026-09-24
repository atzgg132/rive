// Workspace-user two-factor authentication: TOTP secret lifecycle, recovery
// codes, and the pure verification logic the domain tests exercise directly.
//
// Deliberately free of `server-only` so the pure functions (recovery code
// hashing/matching, replay-guarded TOTP verification) can be asserted in the
// no-DB domain tests. Only the two encrypt/decrypt helpers touch env-gated
// key material, mirroring calendarCrypto.ts's own split.
import crypto from "crypto";
import {
  generateTotpSecret as generateTotpSecretCore,
  verifyTotpWithReplayGuard,
} from "@/utils/totp";

export { generateTotpSecretCore as generateTotpSecret, verifyTotpWithReplayGuard };

const RECOVERY_CODE_COUNT = 10;
// Base32 (Crockford-adjacent, no ambiguous chars) split into two groups for
// readability, e.g. "K7QX-3MRT". Codes are single-use and stored only as a
// SHA-256 hash — never in plaintext — so a database read alone cannot forge one.
const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomRecoveryCode(): string {
  const bytes = crypto.randomBytes(8);
  let raw = "";
  for (const byte of bytes) raw += RECOVERY_CODE_ALPHABET[byte % RECOVERY_CODE_ALPHABET.length];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function normalizeRecoveryCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

export type GeneratedRecoveryCode = { code: string; codeHash: string };

/** Generates a fresh set of 10 single-use recovery codes, plaintext + hash pairs. */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): GeneratedRecoveryCode[] {
  const codes: GeneratedRecoveryCode[] = [];
  const seen = new Set<string>();
  while (codes.length < count) {
    const code = randomRecoveryCode();
    if (seen.has(code)) continue; // astronomically unlikely, but keep the set unique
    seen.add(code);
    codes.push({ code, codeHash: hashRecoveryCode(code) });
  }
  return codes;
}

export type StoredRecoveryCode = { id: string; codeHash: string; usedAt: Date | null };

/**
 * Matches a submitted recovery code against the unused stored hashes.
 * Pure and DB-free: the caller persists `usedAt` for the returned id.
 */
export function matchRecoveryCode(
  submitted: string,
  storedCodes: StoredRecoveryCode[],
): StoredRecoveryCode | null {
  const submittedHash = hashRecoveryCode(submitted);
  const submittedBuffer = Buffer.from(submittedHash, "utf8");
  for (const stored of storedCodes) {
    if (stored.usedAt) continue;
    const storedBuffer = Buffer.from(stored.codeHash, "utf8");
    if (storedBuffer.length === submittedBuffer.length && crypto.timingSafeEqual(storedBuffer, submittedBuffer)) {
      return stored;
    }
  }
  return null;
}

/** True when a submitted code looks like a recovery code rather than a 6-digit TOTP. */
export function looksLikeRecoveryCode(value: string): boolean {
  return !/^\d{6}$/.test(value.trim());
}

export function buildOtpAuthUri(secretBase32: string, accountEmail: string, issuer = "rive.work"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Splits a base32 secret into groups of 4 for display as a manual entry key. */
export function formatManualKey(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, "$1 ").trim();
}

// --- Secret at-rest encryption -------------------------------------------
//
// Reuses the calendar/connector credential envelope (AES-256-GCM, versioned
// key id, same CALENDAR_ENCRYPTION_KEY material) rather than inventing a
// second encryption scheme. Kept as a thin async wrapper so this module still
// loads in the no-DB domain test runtime without requiring "server-only".
export async function encryptTwoFactorSecret(secretBase32: string): Promise<string> {
  const { encryptCalendarCredentials } = await import("@/utils/calendarCrypto");
  return encryptCalendarCredentials({ secret: secretBase32 });
}

export async function decryptTwoFactorSecret(encrypted: string): Promise<string> {
  const { decryptCalendarCredentials } = await import("@/utils/calendarCrypto");
  const payload = decryptCalendarCredentials<{ secret: string }>(encrypted);
  return payload.secret;
}
