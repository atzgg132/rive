import crypto from "crypto";

const SECRET_KEY = process.env.DATABASE_URL || "rive-static-salt-key-1294";
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
  if (!token) return false;
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

    return signature === expectedSignature;
  } catch {
    return false;
  }
}
