import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { rateLimit } from "@/utils/rateLimit";
import { buildOtpAuthUri, encryptTwoFactorSecret, formatManualKey, generateTotpSecret } from "@/utils/twoFactor";

// Starts (or restarts) enrollment: generates a fresh secret, stores it
// encrypted, but does not enable 2FA yet — enroll/confirm does that once a
// code from it verifies. Restarting simply overwrites the pending secret;
// nothing is enabled until confirm succeeds, so this is safe to call again.
export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`2fa:enroll-start:${session.userId}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, twoFactorEnabledAt: true },
  });
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (user.twoFactorEnabledAt) {
    return NextResponse.json({ success: false, message: "Two-factor authentication is already on." }, { status: 409 });
  }

  const secret = generateTotpSecret();
  const encrypted = await encryptTwoFactorSecret(secret);
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecretEncrypted: encrypted, twoFactorLastUsedStep: null } });

  return NextResponse.json({
    success: true,
    otpauthUri: buildOtpAuthUri(secret, user.email),
    manualKey: formatManualKey(secret),
  });
}
