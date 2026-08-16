import "server-only";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getRequestIp } from "@/utils/rateLimit";
import { verifyToken as verifyLegacyToken } from "@/utils/auth";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_PATH,
  ADMIN_SESSION_TTL_MS,
  LEGACY_ADMIN_SESSION_COOKIE_PATH,
} from "@/utils/adminSessionCookie";

export { ADMIN_SESSION_COOKIE, ADMIN_SESSION_COOKIE_PATH };

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: ADMIN_SESSION_COOKIE_PATH,
  };
}

// NextResponse.cookies keys its pending cookies by name alone and rewrites the
// whole Set-Cookie header on every call, so it cannot express two cookies that
// share a name and differ only by path. Appending the expiry directly is the only
// way to retire the old scope alongside the new cookie — and it has to happen
// after every response.cookies.set() call, which would otherwise drop it.
function expireLegacyScopedCookie(response: NextResponse): void {
  const attributes = [
    `${ADMIN_SESSION_COOKIE}=`,
    `Path=${LEGACY_ADMIN_SESSION_COOKIE_PATH}`,
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  response.headers.append("set-cookie", attributes.join("; "));
}

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashIp(value: string): string {
  return hash(`${process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-admin"}:${value}`);
}

export async function createAdminSession(req: NextRequest, response: NextResponse): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.adminSession.create({
    data: {
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
      ipHash: hashIp(getRequestIp(req)),
      userAgent: req.headers.get("user-agent")?.slice(0, 500) || null,
    },
  });
  response.cookies.set({
    ...sessionCookieOptions(),
    name: ADMIN_SESSION_COOKIE,
    value: token,
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  });
  expireLegacyScopedCookie(response);
}

export async function hasAdminSession(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (cookie) {
    const session = await prisma.adminSession.findUnique({ where: { tokenHash: hash(cookie) } }).catch(() => null);
    if (session && !session.revokedAt && session.expiresAt > new Date()) {
      await prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
      return true;
    }
  }

  // Compatibility for local scripts and the legacy admin E2E fixture. The
  // application UI no longer stores or sends this header, and production never
  // accepts it as an authentication mechanism.
  const localCompatibility = ["development", "test"].includes(process.env.NODE_ENV || "")
    || ["local", "development", "test"].includes((process.env.APP_ENV || "").toLowerCase());
  return localCompatibility && verifyLegacyToken(req.headers.get("x-admin-token"));
}

export async function revokeAdminSession(req: NextRequest, response: NextResponse): Promise<void> {
  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (cookie) await prisma.adminSession.updateMany({ where: { tokenHash: hash(cookie), revokedAt: null }, data: { revokedAt: new Date() } }).catch(() => undefined);
  response.cookies.set({ ...sessionCookieOptions(), name: ADMIN_SESSION_COOKIE, value: "", expires: new Date(0) });
  expireLegacyScopedCookie(response);
}
