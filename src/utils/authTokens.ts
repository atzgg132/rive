import crypto from "crypto";
import { prisma } from "@/utils/db";

export type AuthTokenType = "waitlist_invite" | "password_reset";

const TOKEN_TTLS: Record<AuthTokenType, number> = {
  waitlist_invite: 7 * 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

export function hashAuthToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function prepareAuthToken({
  email,
  type,
  userId,
}: {
  email: string;
  type: AuthTokenType;
  userId?: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTLS[type]);

  return {
    token,
    expiresAt,
    data: {
      email: normalizedEmail,
      type,
      userId,
      tokenHash: hashAuthToken(token),
      expiresAt,
    },
  };
}

export async function createAuthToken({
  email,
  type,
  userId,
}: {
  email: string;
  type: AuthTokenType;
  userId?: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const prepared = prepareAuthToken({ email, type, userId });

  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { email: prepared.data.email, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: prepared.data,
    }),
  ]);

  return { token: prepared.token, expiresAt: prepared.expiresAt };
}

export async function findValidAuthToken(token: string, type: AuthTokenType) {
  if (!token || token.length > 256) return null;

  return prisma.authToken.findFirst({
    where: {
      tokenHash: hashAuthToken(token),
      type,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}
