import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { createAuthToken, findValidAuthToken } from "@/utils/authTokens";

// The pending second-login-step credential: issued after a correct password
// or Google sign-in when the account has 2FA enabled, before a session
// exists. Carried as its own short-lived httpOnly cookie (never the session
// cookie) so a stolen challenge cannot be replayed as a signed-in session,
// and so /login/two-factor never needs the raw token in the URL or history.
const CHALLENGE_COOKIE_NAME = "rive_2fa_challenge";
const CHALLENGE_TTL_SECONDS = 10 * 60;

export async function createTwoFactorChallenge(userId: string, email: string): Promise<string> {
  const { token } = await createAuthToken({ email, type: "two_factor_challenge", userId });
  return token;
}

export function setTwoFactorChallengeCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: CHALLENGE_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CHALLENGE_TTL_SECONDS,
    path: "/",
  });
}

export function clearTwoFactorChallengeCookie(response: NextResponse): void {
  response.cookies.set({
    name: CHALLENGE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export function getTwoFactorChallengeToken(req: NextRequest): string | null {
  return req.cookies.get(CHALLENGE_COOKIE_NAME)?.value || null;
}

/**
 * Reads a pending challenge without consuming it, so a wrong code can be
 * retried (up to the durable rate limit) without forcing the person back
 * through the password step. Only a correct code should finalize it.
 */
export async function peekTwoFactorChallenge(
  token: string | null,
): Promise<{ id: string; userId: string; email: string } | null> {
  if (!token) return null;
  const record = await findValidAuthToken(token, "two_factor_challenge");
  if (!record || !record.userId) return null;
  return { id: record.id, userId: record.userId, email: record.email };
}

/**
 * Marks a pending challenge used once its code has verified. Single-use and
 * atomic: a concurrently retried request cannot finalize the same challenge
 * twice, so the login step can only ever create one session from it.
 */
export async function finalizeTwoFactorChallenge(challengeId: string): Promise<boolean> {
  const claimed = await prisma.authToken.updateMany({
    where: { id: challengeId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return claimed.count === 1;
}
