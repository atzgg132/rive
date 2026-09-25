import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { normalizeEmailAddress } from "@/lib/email-address";
import { readJsonBody } from "@/utils/apiBoundary";
import { isValidPaymentTermsDays } from "@/lib/settingsDomain";

// Business & invoicing settings — the invoice profile fields that used to
// live at /workflow/invoice-settings, now under Settings. `defaultCurrency`
// on this record is intentionally no longer read or written: the single
// workspace default currency lives on `User.currency` (see
// src/app/api/settings/workspace). The column itself is kept for the
// historical backfill migration.
function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().slice(0, max);
  return result || null;
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const profile = await prisma.invoiceProfile.findUnique({ where: { userId: session.userId } });
  return NextResponse.json({ success: true, profile });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const invoicePrefix = (text(body.invoicePrefix, 16) || "INV").replace(/[^A-Za-z0-9-]/g, "");
  if (!invoicePrefix) return NextResponse.json({ success: false, message: "Use a valid invoice prefix." }, { status: 400 });
  const emailInput = text(body.email, 1_000);
  const email = emailInput ? normalizeEmailAddress(emailInput) : null;
  if (emailInput && !email) return NextResponse.json({ success: false, message: "Use a valid contact email." }, { status: 400 });

  let defaultPaymentTermsDays: number | null = null;
  if (Object.prototype.hasOwnProperty.call(body, "defaultPaymentTermsDays") && body.defaultPaymentTermsDays !== null && body.defaultPaymentTermsDays !== "") {
    const parsed = Number(body.defaultPaymentTermsDays);
    if (!isValidPaymentTermsDays(parsed)) {
      return NextResponse.json({ success: false, message: "Default payment terms must be a whole number of days between 0 and 365." }, { status: 400 });
    }
    defaultPaymentTermsDays = parsed;
  }

  const fields = {
    businessName: text(body.businessName, 180),
    contactName: text(body.contactName, 160),
    email,
    phone: text(body.phone, 80),
    address: text(body.address, 1_000),
    taxId: text(body.taxId, 120),
    logoUrl: text(body.logoUrl, 1_000),
    invoicePrefix,
    paymentInstructions: text(body.paymentInstructions, 2_000),
    defaultTerms: text(body.defaultTerms, 2_000),
    defaultPaymentTermsDays,
  };

  const profile = await prisma.invoiceProfile.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, ...fields },
    update: fields,
  });
  return NextResponse.json({ success: true, profile });
}
