import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { hashPassword, generateUserToken, setSessionCookie } from "@/utils/userAuth";
import { findValidAuthToken } from "@/utils/authTokens";
import { sendRegistrationCompleteEmail } from "@/utils/email";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    if (!rateLimit(`register:${ip}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, message: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    const { email, password, name, inviteToken } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedName = typeof name === "string" ? name.trim() : "";
    if (
      !normalizedEmail ||
      !/^\S+@\S+\.\S+$/.test(normalizedEmail) ||
      typeof password !== "string" ||
      password.length < 8 ||
      !normalizedName ||
      typeof inviteToken !== "string"
    ) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    const invitation = await findValidAuthToken(inviteToken, "waitlist_invite");
    if (!invitation || invitation.email !== normalizedEmail) {
      return NextResponse.json(
        { success: false, message: "This invitation is invalid or has expired. Please request a new invitation." },
        { status: 403 },
      );
    }

    const waitlistEntry = await prisma.waitlist.findUnique({ where: { email: normalizedEmail } });
    if (!waitlistEntry || waitlistEntry.status !== "approved") {
      return NextResponse.json({ success: false, message: "This invitation is no longer active." }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ success: false, message: "Email is already registered." }, { status: 409 });
    }

    const passwordHash = hashPassword(password);
    const user = await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.authToken.updateMany({
        where: { id: invitation.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("INVITATION_ALREADY_USED");

      return transaction.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: normalizedName,
          plan: "free",
        },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
        },
      });
    });

    const sessionToken = generateUserToken(user.id, user.email, user.plan);
    const emailResult = await sendRegistrationCompleteEmail(user.email, user.name || normalizedName);
    const response = NextResponse.json(
      {
        success: true,
        message: "Registration successful.",
        emailSent: emailResult.sent,
        user,
      },
      { status: 201 },
    );
    setSessionCookie(response, sessionToken);
    return response;
  } catch (error: unknown) {
    console.error("Registration error:", error);
    if (error instanceof Error && error.message === "INVITATION_ALREADY_USED") {
      return NextResponse.json({ success: false, message: "This invitation has already been used." }, { status: 409 });
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Internal server error." },
      { status: 500 },
    );
  }
}
