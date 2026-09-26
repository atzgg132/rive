import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { generateUserToken, getSessionUser, setSessionCookie } from "@/utils/userAuth";
import { rateLimit, getRequestIp } from "@/utils/rateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { readJsonBody } from "@/utils/apiBoundary";
import { verifyTwoFactorReauth } from "@/utils/twoFactorReauth";
import { generateRecoveryCodes } from "@/utils/twoFactor";
import { getEmailProvider, sendTwoFactorRecoveryCodesRegeneratedEmail } from "@/utils/email";

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`2fa:regen-codes:${session.userId}`, 8, 15 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
  }

  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const password = typeof parsedBody.body.password === "string" ? parsedBody.body.password : undefined;
  const code = typeof parsedBody.body.code === "string" ? parsedBody.body.code.trim() : undefined;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true, email: true, plan: true, sessionVersion: true, passwordHash: true,
      twoFactorSecretEncrypted: true, twoFactorEnabledAt: true, twoFactorLastUsedStep: true,
    },
  });
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!user.twoFactorEnabledAt || !user.twoFactorSecretEncrypted) {
    return NextResponse.json({ success: false, message: "Two-factor authentication is off." }, { status: 409 });
  }

  const reauth = await verifyTwoFactorReauth(
    { id: user.id, passwordHash: user.passwordHash, twoFactorSecretEncrypted: user.twoFactorSecretEncrypted, twoFactorLastUsedStep: user.twoFactorLastUsedStep },
    { password, code },
  );
  if (!reauth.ok) return NextResponse.json({ success: false, message: reauth.message }, { status: 401 });

  const recoveryCodes = generateRecoveryCodes();
  const newSessionVersion = user.sessionVersion + 1;
  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: recoveryCodes.map(({ codeHash }) => ({ userId: user.id, codeHash })),
    }),
    prisma.user.update({ where: { id: user.id }, data: { sessionVersion: newSessionVersion } }),
  ]);

  await prisma.auditEvent.create({
    data: { userId: user.id, action: "security.two_factor_recovery_codes_regenerated", ipHash: hashRequestValue(getRequestIp(req)) },
  }).catch((error) => console.warn("Two-factor recovery codes regenerated audit write failed:", error));

  if (getEmailProvider() !== "disabled") {
    await sendTwoFactorRecoveryCodesRegeneratedEmail(user.email).catch((mailError) => {
      console.error("Two-factor recovery codes regenerated email failed:", mailError);
    });
  }

  const response = NextResponse.json({
    success: true,
    message: "New recovery codes issued.",
    recoveryCodes: recoveryCodes.map(({ code: plainCode }) => plainCode),
  });
  setSessionCookie(response, generateUserToken(user.id, user.email, user.plan, newSessionVersion));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
