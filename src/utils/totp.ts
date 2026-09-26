// RFC 6238 TOTP core, shared by the admin login second factor (adminTotp.ts)
// and workspace-user two-factor authentication (twoFactor.ts).
//
// Deliberately free of `server-only` and `next/server` imports so the
// verification contract can be asserted directly in the no-DB domain tests —
// the same reason adminSessionCookie.ts stays dependency-free.
import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
// One step of drift in each direction absorbs authenticator clock skew and a
// slow operator without weakening the code meaningfully.
export const TOTP_WINDOW_STEPS = 1;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let accumulator = 0;
  let output = "";
  for (const byte of buffer) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(accumulator >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(accumulator << (5 - bits)) & 31];
  return output;
}

export function base32Decode(value: string): Buffer | null {
  const clean = value.replace(/[\s=-]/g, "").toUpperCase();
  if (!clean.length || /[^A-Z2-7]/.test(clean)) return null;
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];
  for (const character of clean) {
    accumulator = (accumulator << 5) | BASE32_ALPHABET.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totpStep(timestampMs: number): number {
  return Math.floor(timestampMs / 1000 / TOTP_STEP_SECONDS);
}

function hotp(secret: Buffer, counter: bigint): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = crypto.createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (
    ((digest[offset] & 0x7f) << 24)
    | (digest[offset + 1] << 16)
    | (digest[offset + 2] << 8)
    | digest[offset + 3]
  ) % 10 ** TOTP_DIGITS;
  return String(code).padStart(TOTP_DIGITS, "0");
}

export function totpCode(secretBase32: string, timestampMs: number): string | null {
  const secret = base32Decode(secretBase32);
  if (!secret?.length) return null;
  return hotp(secret, BigInt(totpStep(timestampMs)));
}

export function verifyTotp(code: string, secretBase32: string): boolean {
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code)) return false;
  const secret = base32Decode(secretBase32);
  if (!secret?.length) return false;
  const step = totpStep(Date.now());
  const provided = Buffer.from(code, "utf8");
  for (let drift = -TOTP_WINDOW_STEPS; drift <= TOTP_WINDOW_STEPS; drift += 1) {
    const expected = Buffer.from(hotp(secret, BigInt(step + drift)), "utf8");
    if (crypto.timingSafeEqual(provided, expected)) return true;
  }
  return false;
}

/**
 * As `verifyTotp`, but also enforces that a step already consumed cannot be
 * replayed even though the six-digit code still matches (the same code is
 * valid for the whole 30s step). Callers persist the returned `usedStep` and
 * pass it back in as `lastUsedStep` on the next attempt.
 */
export function verifyTotpWithReplayGuard(
  code: string,
  secretBase32: string,
  lastUsedStep: number | null | undefined,
  now: number = Date.now(),
): { ok: true; usedStep: number } | { ok: false; usedStep: null } {
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code)) return { ok: false, usedStep: null };
  const secret = base32Decode(secretBase32);
  if (!secret?.length) return { ok: false, usedStep: null };
  const step = totpStep(now);
  const provided = Buffer.from(code, "utf8");
  for (let drift = -TOTP_WINDOW_STEPS; drift <= TOTP_WINDOW_STEPS; drift += 1) {
    const candidateStep = step + drift;
    const expected = Buffer.from(hotp(secret, BigInt(candidateStep)), "utf8");
    if (crypto.timingSafeEqual(provided, expected)) {
      if (typeof lastUsedStep === "number" && candidateStep <= lastUsedStep) {
        return { ok: false, usedStep: null };
      }
      return { ok: true, usedStep: candidateStep };
    }
  }
  return { ok: false, usedStep: null };
}

/** A configured secret only counts when it decodes to real key material. */
export function isUsableTotpSecret(secretBase32: string | null | undefined): boolean {
  if (!secretBase32) return false;
  const decoded = base32Decode(secretBase32);
  return decoded !== null && decoded.length > 0;
}
