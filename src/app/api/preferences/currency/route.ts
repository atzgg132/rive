import { NextRequest, NextResponse } from "next/server";
import { isDisplayCurrency } from "@/lib/currency";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function PATCH(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const displayCurrency = typeof body?.displayCurrency === "string" ? body.displayCurrency.toUpperCase() : null;
  if (!isDisplayCurrency(displayCurrency)) {
    return NextResponse.json({ success: false, message: "Choose a supported display currency." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { displayCurrency },
    select: { displayCurrency: true },
  });

  return NextResponse.json({ success: true, displayCurrency: user.displayCurrency });
}
