import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { readJsonBody } from "@/utils/apiBoundary";
import { canonicalTimeZone } from "@/utils/calendar";
import { isValidWorkspaceCurrency } from "@/lib/settingsDomain";

// Workspace defaults: one default currency (used by new projects, invoices
// without a linked project, agreements, expenses, and imports — see
// src/lib/settingsDomain.ts#resolveRecordCurrency) and one time zone. Display
// currency is a separate, purely cosmetic preference (see
// src/app/api/preferences/currency) and is not touched here.
export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const data: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(body, "currency")) {
    const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
    if (!isValidWorkspaceCurrency(currency)) {
      return NextResponse.json({ success: false, message: "Use a valid 3-letter currency code." }, { status: 400 });
    }
    data.currency = currency;
  }
  if (Object.prototype.hasOwnProperty.call(body, "timeZone")) {
    const timeZone = typeof body.timeZone === "string" ? canonicalTimeZone(body.timeZone) : null;
    if (!timeZone) return NextResponse.json({ success: false, message: "Use a valid time zone." }, { status: 400 });
    data.timeZone = timeZone;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, message: "Nothing to save." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: { currency: true, timeZone: true },
  });
  return NextResponse.json({ success: true, user });
}
