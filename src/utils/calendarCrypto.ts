import crypto from "crypto";
import { createConnectorOAuthState, verifyConnectorOAuthState } from "@/utils/connectorSecurity";

function encryptionKey(): Buffer {
  // Deliberately does not fall back to SESSION_SECRET: that secret also signs
  // sessions and OAuth state, and reusing it here would mean one leaked value
  // compromises session integrity, OAuth CSRF protection, and calendar/Zoho
  // token confidentiality all at once. connectorConfig.ts's availability
  // checks already keep both connectors off without this key configured; this
  // throw is the defense-in-depth backstop if that's ever bypassed.
  const secret = process.env.CALENDAR_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("CALENDAR_ENCRYPTION_KEY is required for calendar and connector credential storage.");
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
