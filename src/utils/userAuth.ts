import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { isEmailVerificationSatisfied } from "@/utils/emailVerification";

// Keep the existing DATABASE_URL fallback so currently issued sessions remain valid,
// but never allow a predictable development key in production.
const configuredSecret = process.env.SESSION_SECRET || process.env.DATABASE_URL;
if (process.env.NODE_ENV === "production" && !configuredSecret) {
  throw new Error("SESSION_SECRET must be configured in production.");
}
const SECRET_KEY = configuredSecret || "rive-local-development-session-secret";
const TOKEN_COOKIE_NAME = "rive_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Pure Node.js PBKDF2 Password Hashing
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    const isScrypt = parts[0] === "scrypt";
    const salt = isScrypt ? parts[1] : parts[0];
    const originalHash = isScrypt ? parts[2] : parts[1];
    if (!salt || !originalHash) return false;
    const hash = isScrypt
      ? crypto.scryptSync(password, salt, 64)
      : crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512");
    const original = Buffer.from(originalHash, "hex");
    return original.length === hash.length && crypto.timingSafeEqual(original, hash);
  } catch {
    return false;
  }
}

export function passwordNeedsUpgrade(storedHash: string): boolean {
  return !storedHash.startsWith("scrypt:");
}

// Session Token Generation & Verification (Stateless HMAC Tokens)
export interface UserSession {
  userId: string;
  email: string;
  plan: string;
  sessionVersion: number;
  expiry: number;
}

export function generateUserToken(userId: string, email: string, plan: string, sessionVersion = 0): string {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = JSON.stringify({ userId, email, plan, sessionVersion, expiry });
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
      
    const providedSignature = Buffer.from(signature, "hex");
    const expectedSignatureBuffer = Buffer.from(expectedSignature, "hex");
    if (providedSignature.length !== expectedSignatureBuffer.length || !crypto.timingSafeEqual(providedSignature, expectedSignatureBuffer)) return null;
    
    const parsed = JSON.parse(payloadStr) as Partial<UserSession>;
    const session: UserSession = {
      userId: typeof parsed.userId === "string" ? parsed.userId : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      plan: typeof parsed.plan === "string" ? parsed.plan : "free",
      sessionVersion: Number.isInteger(parsed.sessionVersion) ? parsed.sessionVersion as number : 0,
      expiry: typeof parsed.expiry === "number" ? parsed.expiry : 0,
    };
    if (!session.userId || !session.email || !session.expiry) return null;
    if (Date.now() > session.expiry) {
      return null; // Expired
    }
    
    return session;
  } catch {
    return null;
  }
}

// Get the authenticated session from the signed, httpOnly cookie.
export async function getSessionUser(req: NextRequest): Promise<UserSession | null> {
  // The session cookie is the only browser-controlled credential we trust.
  // A plain JSON identity header can be forged by any caller and this app has
  // no verified proxy that injects one. Keeping this boundary in one helper
  // prevents every protected route from accidentally becoming an IDOR.
  const cookie = req.cookies.get(TOKEN_COOKIE_NAME)?.value;
  const session = verifyUserToken(cookie || null);
  if (!session) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, plan: true, sessionVersion: true, emailVerifiedAt: true, emailVerificationRequiredAt: true },
    });
    if (!user || user.sessionVersion !== session.sessionVersion) return null;
    if (!isEmailVerificationSatisfied(user)) return null;
    return { ...session, email: user.email, plan: user.plan };
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: TOKEN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}

export { TOKEN_COOKIE_NAME, SESSION_TTL_MS };
