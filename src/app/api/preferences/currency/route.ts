import { NextRequest, NextResponse } from "next/server";
import { isDisplayCurrency } from "@/lib/currency";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { readJsonBody } from "@/utils/apiBoundary";

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
  const displayCurrency = typeof body.displayCurrency === "string" ? body.displayCurrency.trim().toUpperCase() : null;
  if (!isDisplayCurrency(displayCurrency)) {
    return NextResponse.json({ success: false, message: "Choose a supported display currency." }, { status: 400 });
  }

  const requestedSelection = body.selection;
  if (requestedSelection !== undefined && requestedSelection !== "explicit" && requestedSelection !== "detected") {
    return NextResponse.json({ success: false, message: "Choose an explicit or detected currency selection." }, { status: 400 });
  }
  // Omitted selection is kept backward-compatible with the original endpoint,
  // which treated every preference update as an explicit user choice.
  const selection = requestedSelection === "detected" ? "detected" : "explicit";
  if (selection === "detected") {
    // Keep the precedence check in the write predicate so a detected-currency
    // action cannot race an explicit user choice and overwrite it.
    const updated = await prisma.user.updateMany({
      where: { id: session.userId, displayCurrencySource: { not: "user" } },
      data: { displayCurrency, displayCurrencySource: "inferred" },
    });
    if (updated.count !== 1) {
      const current = await prisma.user.findUnique({ where: { id: session.userId }, select: { displayCurrencySource: true } });
      if (!current) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      return NextResponse.json({ success: false, message: "Your chosen currency is already locked in." }, { status: 409 });
    }
  } else {
    await prisma.user.update({
      where: { id: session.userId },
      data: { displayCurrency, displayCurrencySource: "user" },
    });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { displayCurrency: true, displayCurrencySource: true },
  });

  return NextResponse.json({
    success: true,
    displayCurrency: user.displayCurrency,
    displayCurrencySource: user.displayCurrencySource,
  });
}
