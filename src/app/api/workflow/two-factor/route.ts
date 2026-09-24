import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { twoFactorEnabledAt: true },
  });
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const remainingRecoveryCodes = user.twoFactorEnabledAt
    ? await prisma.twoFactorRecoveryCode.count({ where: { userId: session.userId, usedAt: null } })
    : 0;

  return NextResponse.json({
    success: true,
    enabled: Boolean(user.twoFactorEnabledAt),
    enabledAt: user.twoFactorEnabledAt,
    remainingRecoveryCodes,
  });
}
