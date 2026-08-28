import crypto from "crypto";
import { googleLoginAvailable } from "@/utils/connectorConfig";
import { safeNextPath } from "@/utils/safeNextPath";
import { GOOGLE_LOGIN_SCOPES } from "@/utils/googleScopes";

export { GOOGLE_LOGIN_SCOPES };

function googleLoginConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  if (!googleLoginAvailable() || !clientId || !clientSecret) {
    throw new Error("Google sign-in is not enabled for this deployment.");
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/google/callback`,
    appUrl,
  };
}

export function createGoogleLoginState(nextPath: string | null | undefined): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for Google sign-in.");
  const payload = Buffer.from(JSON.stringify({
    purpose: "google_login",
    next: safeNextPath(nextPath) || "",
    expiresAt: Date.now() + 10 * 60 * 1000,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyGoogleLoginState(value: string): { next: string } | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      purpose?: string;
      next?: string;
      expiresAt?: number;
    };
    if (parsed.purpose !== "google_login" || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) {
      return null;
    }
    return { next: safeNextPath(parsed.next) || "" };
  } catch {
    return null;
  }
}

export function googleLoginAuthorizationUrl(state: string): string {
  const config = googleLoginConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_LOGIN_SCOPES.join(" "),
    state,
    prompt: "select_account",
    include_granted_scopes: "false",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleLoginCode(code: string): Promise<{ accessToken: string }> {
  const config = googleLoginConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`Google login token exchange failed (${response.status}).`);
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error("Google login token exchange returned no access token.");
  return { accessToken: payload.access_token };
}

export type GoogleLoginProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export async function getGoogleLoginProfile(accessToken: string): Promise<GoogleLoginProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not read the Google account.");
  const payload = await response.json() as {
    sub?: unknown;
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
  };
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 160) : "";
  if (!sub || !email) throw new Error("Google account is missing an email address.");
  return { sub, email, emailVerified, name };
}
