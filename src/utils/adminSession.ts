import "server-only";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getRequestIp } from "@/utils/rateLimit";
import { verifyToken as verifyLegacyToken } from "@/utils/auth";

export const ADMIN_SESSION_COOKIE = "rive_admin_session";
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

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
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
    path: "/admin",
  });
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
  response.cookies.set({ name: ADMIN_SESSION_COOKIE, value: "", httpOnly: true, expires: new Date(0), sameSite: "lax", path: "/admin" });
}
