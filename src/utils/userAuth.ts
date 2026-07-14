import crypto from "crypto";
import { NextRequest } from "next/server";

const SECRET_KEY = process.env.DATABASE_URL || "rive-user-secret-salt-9876";
const TOKEN_COOKIE_NAME = "rive_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Pure Node.js PBKDF2 Password Hashing
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(":");
    if (!salt || !originalHash) return false;
    const hash = crypto
      .pbkdf2Sync(password, salt, 1000, 64, "sha512")
      .toString("hex");
    return hash === originalHash;
  } catch {
    return false;
  }
}

// Session Token Generation & Verification (Stateless HMAC Tokens)
export interface UserSession {
  userId: string;
  email: string;
  plan: string;
  expiry: number;
}

export function generateUserToken(userId: string, email: string, plan: string): string {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = JSON.stringify({ userId, email, plan, expiry });
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(payload)
    .digest("hex");
  
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

export function verifyUserToken(token: string | null): UserSession | null {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, "base64").toString("utf-8");
    const dotIndex = raw.lastIndexOf(".");
    if (dotIndex === -1) return null;
    
    const payloadStr = raw.substring(0, dotIndex);
    const signature = raw.substring(dotIndex + 1);
    
    const expectedSignature = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(payloadStr)
      .digest("hex");
      
    if (signature !== expectedSignature) return null;
    
    const session: UserSession = JSON.parse(payloadStr);
    if (Date.now() > session.expiry) {
      return null; // Expired
    }
    
    return session;
  } catch {
    return null;
  }
}

// Get session from headers (passed by middleware) or cookies
export function getSessionUser(req: NextRequest): UserSession | null {
  // 1. Try header injected by middleware
  const headerUser = req.headers.get("x-user-session");
  if (headerUser) {
    try {
      return JSON.parse(headerUser);
    } catch {}
  }
  
  // 2. Try directly from cookie
  const cookie = req.cookies.get(TOKEN_COOKIE_NAME)?.value;
  return verifyUserToken(cookie || null);
}

export { TOKEN_COOKIE_NAME, SESSION_TTL_MS };
