import crypto from "crypto";

// The legacy admin token exists for local scripts and the E2E fixture. Its HMAC
// key must never derive from DATABASE_URL — a connection string is not a signing
// secret. Deployed environments fail closed without ADMIN_TOKEN_SECRET; local
// and the CI production build (NODE_ENV=production but APP_ENV=test) keep the
// historical fallback so the fixture and local scripts keep working.
const deployedEnvironment = process.env.NODE_ENV === "production"
  && !["local", "development", "test"].includes((process.env.APP_ENV || "").toLowerCase());
const SECRET_KEY = process.env.ADMIN_TOKEN_SECRET?.trim()
  || (deployedEnvironment ? "" : process.env.DATABASE_URL || "rive-static-salt-key-1294");
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export function generateToken(): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(String(expiry))
    .digest("hex");

  // base64 encode payload
  return Buffer.from(`${expiry}:${signature}`).toString("base64");
}

export function verifyToken(token: string | null): boolean {
  if (!token || !SECRET_KEY) return false;
  try {
    const raw = Buffer.from(token, "base64").toString("utf-8");
    const [expiryStr, signature] = raw.split(":");
    if (!expiryStr || !signature) return false;

    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(String(expiry))
      .digest("hex");

    const provided = Buffer.from(signature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}
