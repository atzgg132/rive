import crypto from "node:crypto";

type ConnectorState = {
  userId: string;
  provider: string;
  returnTo: "/onboarding" | "/dashboard";
  expiresAt: number;
};

export function createConnectorOAuthState(
  userId: string,
  provider: string,
  returnTo: ConnectorState["returnTo"] = "/onboarding",
): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for connector OAuth.");
  const payload = Buffer.from(JSON.stringify({
    userId,
    provider,
    returnTo,
    expiresAt: Date.now() + 10 * 60 * 1000,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyConnectorOAuthState(value: string, provider: string): ConnectorState | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ConnectorState;
    if (!parsed.userId || parsed.provider !== provider || parsed.expiresAt <= Date.now()) return null;
    return {
      userId: parsed.userId,
      provider,
      returnTo: parsed.returnTo === "/dashboard" ? "/dashboard" : "/onboarding",
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}
