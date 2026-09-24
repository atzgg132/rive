import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser, generateUserToken, setSessionCookie } from "@/utils/userAuth";
import { durableRateLimit } from "@/utils/durableRateLimit";

// Signs out every other session by bumping sessionVersion, then re-issues a
// fresh cookie for this request so the person making the change stays
// signed in on the device they're using right now.
export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  if (!await durableRateLimit(`settings:sign-out-all:${session.userId}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: { sessionVersion: { increment: 1 } },
    select: { id: true, email: true, plan: true, sessionVersion: true },
  });

  const response = NextResponse.json({ success: true, message: "Signed out of all other devices." });
  setSessionCookie(response, generateUserToken(updated.id, updated.email, updated.plan, updated.sessionVersion));
  return response;
}
