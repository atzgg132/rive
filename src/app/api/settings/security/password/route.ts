import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser, verifyPassword, hashPassword, generateUserToken, setSessionCookie, isGooglePlaceholderPassword } from "@/utils/userAuth";
import { readJsonBody } from "@/utils/apiBoundary";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { getRequestIp } from "@/utils/rateLimit";
import { buildPasswordChangedEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";

// Change (or, for a Google-only account with no password yet, set) the
// account password. Bumps sessionVersion so every other outstanding session
// is invalidated, then re-issues a fresh cookie for *this* request so the
// person making the change stays signed in.
export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const ip = getRequestIp(req);
  if (!await durableRateLimit(`settings:password-change:${session.userId}`, 10, 15 * 60 * 1000)
    || !await durableRateLimit(`settings:password-change:ip:${ip}`, 30, 15 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
  }

  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 8) {
    return NextResponse.json({ success: false, message: "Use at least 8 characters for your new password." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

  const isGoogleOnly = Boolean(user.googleSubject) && isGooglePlaceholderPassword(user.passwordHash);
  if (!isGoogleOnly) {
    if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json({ success: false, message: "Current password is incorrect." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: hashPassword(newPassword), sessionVersion: { increment: 1 } },
    select: { id: true, email: true, plan: true, sessionVersion: true },
  });

  if (getEmailProvider() !== "disabled") {
    const outboxId = await enqueueEmail(buildPasswordChangedEmail(updated.email)).catch(() => null);
    if (outboxId) {
      await processEmailOutbox({ jobId: outboxId }).catch((mailError) => {
        console.error("Immediate password-changed email attempt failed:", mailError);
      });
    }
  }

  const response = NextResponse.json({ success: true, message: isGoogleOnly ? "Password set." : "Password changed." });
  // The sessionVersion bump above just invalidated the cookie on this very
  // request; issue a fresh one matching the new version so the person stays
  // signed in instead of being logged out by their own change.
  setSessionCookie(response, generateUserToken(updated.id, updated.email, updated.plan, updated.sessionVersion));
  return response;
}
