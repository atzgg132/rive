import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { generateUserToken, getSessionUser, setSessionCookie } from "@/utils/userAuth";
import { rateLimit } from "@/utils/rateLimit";
import { readJsonBody } from "@/utils/apiBoundary";
import { generateRecoveryCodes } from "@/utils/twoFactor";
import { consumeTwoFactorCode } from "@/utils/twoFactorVerification";
import { getEmailProvider, sendTwoFactorEnabledEmail } from "@/utils/email";
import { getRequestIp } from "@/utils/rateLimit";
import { hashRequestValue } from "@/utils/contracts";

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`2fa:enroll-confirm:${session.userId}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
  }

  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const code = typeof parsedBody.body.code === "string" ? parsedBody.body.code.trim() : "";
  if (!code) return NextResponse.json({ success: false, message: "Enter the 6-digit code from your authenticator app." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true, email: true, plan: true, sessionVersion: true,
      twoFactorSecretEncrypted: true, twoFactorEnabledAt: true, twoFactorLastUsedStep: true,
    },
  });
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (user.twoFactorEnabledAt) {
    return NextResponse.json({ success: false, message: "Two-factor authentication is already on." }, { status: 409 });
  }
  if (!user.twoFactorSecretEncrypted) {
    return NextResponse.json({ success: false, message: "Start enrollment first." }, { status: 400 });
  }

  const verified = await consumeTwoFactorCode(
    { id: user.id, twoFactorSecretEncrypted: user.twoFactorSecretEncrypted, twoFactorLastUsedStep: user.twoFactorLastUsedStep },
    code,
  );
  if (!verified) return NextResponse.json({ success: false, message: "That code is not valid. Check the time on your device and try again." }, { status: 401 });

  const recoveryCodes = generateRecoveryCodes();
  const newSessionVersion = user.sessionVersion + 1;

  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: recoveryCodes.map(({ codeHash }) => ({ userId: user.id, codeHash })),
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabledAt: new Date(), sessionVersion: newSessionVersion },
    }),
  ]);

  // AuditEvent has @@unique([userId, action]): an enable/disable/enable cycle
  // would collide on a second `create`, so this is best-effort and swallowed
  // rather than allowed to fail the mutation that already succeeded above.
  await prisma.auditEvent.create({
    data: { userId: user.id, action: "security.two_factor_enabled", ipHash: hashRequestValue(getRequestIp(req)) },
  }).catch((error) => console.warn("Two-factor enabled audit write failed:", error));

  if (getEmailProvider() !== "disabled") {
    await sendTwoFactorEnabledEmail(user.email).catch((mailError) => {
      console.error("Two-factor enabled email failed:", mailError);
    });
  }

  const response = NextResponse.json({
    success: true,
    message: "Two-factor authentication is on.",
    recoveryCodes: recoveryCodes.map(({ code: plainCode }) => plainCode),
  });
  setSessionCookie(response, generateUserToken(user.id, user.email, user.plan, newSessionVersion));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
