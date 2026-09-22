import crypto from "crypto";
import { createConnectorOAuthState, verifyConnectorOAuthState } from "@/utils/connectorSecurity";

function keyMaterial(secret: string): Buffer {
  try {
    const decoded = Buffer.from(secret, "base64");
    if (decoded.length === 32) return decoded;
  } catch {}
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptionKeys(): { id: string; material: Buffer }[] {
  // Deliberately does not fall back to SESSION_SECRET: that secret also signs
  // sessions and OAuth state, and reusing it here would mean one leaked value
  // compromises session integrity, OAuth CSRF protection, and calendar/Zoho
  // token confidentiality all at once. connectorConfig.ts's availability
  // checks already keep both connectors off without this key configured; this
  // throw is the defense-in-depth backstop if that's ever bypassed.
  const current = process.env.CALENDAR_ENCRYPTION_KEY;
  if (!current) {
    throw new Error("CALENDAR_ENCRYPTION_KEY is required for calendar and connector credential storage.");
  }
  const previous = process.env.CALENDAR_ENCRYPTION_KEY_PREVIOUS;
  return [
    { id: process.env.CALENDAR_ENCRYPTION_KEY_ID || "v1", material: keyMaterial(current) },
    ...(previous ? [{ id: process.env.CALENDAR_ENCRYPTION_KEY_PREVIOUS_ID || "v1", material: keyMaterial(previous) }] : []),
  ];
}

export function encryptCalendarCredentials(value: object): string {
  const key = encryptionKeys()[0];
  if (!key) throw new Error("CALENDAR_ENCRYPTION_KEY is required for calendar and connector credential storage.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key.material, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${key.id}.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptCalendarCredentials<T>(value: string): T {
  const parts = value.split(".");
  const versioned = parts.length === 4;
  const keyId = versioned ? parts[0] : null;
  const [ivValue, tagValue, payloadValue] = versioned ? parts.slice(1) : parts;
  if (!ivValue || !tagValue || !payloadValue || (versioned && !keyId)) {
    throw new Error("Invalid encrypted calendar credentials.");
  }

  const configuredKeys = encryptionKeys();
  const keys = keyId ? configuredKeys.filter((key) => key.id === keyId) : configuredKeys;
  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key.material, Buffer.from(ivValue, "base64url"));
      decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payloadValue, "base64url")),
        decipher.final(),
      ]);
      return JSON.parse(decrypted.toString("utf8")) as T;
    } catch {}
  }
  throw new Error("Calendar credentials cannot be decrypted with the configured keys.");
}

export function createCalendarOAuthState(userId: string, returnTo: "/calendar" | "/onboarding" = "/calendar"): string {
  // Delegates to the single connector OAuth-state implementation (provider
  // "google") so there is only one HMAC-signed-state implementation to keep
  // secure — a fix in connectorSecurity lands here too.
  return createConnectorOAuthState(userId, "google", returnTo);
}

export function verifyCalendarOAuthState(value: string): { userId: string; returnTo: "/calendar" | "/onboarding" } | null {
  const state = verifyConnectorOAuthState(value, "google");
  if (!state) return null;
  // Calendar flows only ever return to the calendar or onboarding screens.
  return { userId: state.userId, returnTo: state.returnTo === "/onboarding" ? "/onboarding" : "/calendar" };
}
