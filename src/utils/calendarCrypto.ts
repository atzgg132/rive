import crypto from "crypto";

function encryptionKey(): Buffer {
  const secret = process.env.CALENDAR_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("CALENDAR_ENCRYPTION_KEY is required for calendar connections.");
  }
  try {
    const decoded = Buffer.from(secret, "base64");
    if (decoded.length === 32) return decoded;
  } catch {}
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptCalendarCredentials(value: object): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptCalendarCredentials<T>(value: string): T {
  const [ivValue, tagValue, payloadValue] = value.split(".");
  if (!ivValue || !tagValue || !payloadValue) throw new Error("Invalid encrypted calendar credentials.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadValue, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

export function createCalendarOAuthState(userId: string, returnTo: "/calendar" | "/onboarding" = "/calendar"): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for calendar OAuth.");
  const payload = Buffer.from(JSON.stringify({ userId, returnTo, expiresAt: Date.now() + 10 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyCalendarOAuthState(value: string): { userId: string; returnTo: "/calendar" | "/onboarding" } | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId: string; returnTo?: string; expiresAt: number };
    if (!parsed.userId || parsed.expiresAt <= Date.now()) return null;
    return { userId: parsed.userId, returnTo: parsed.returnTo === "/onboarding" ? "/onboarding" : "/calendar" };
  } catch {
    return null;
  }
}
