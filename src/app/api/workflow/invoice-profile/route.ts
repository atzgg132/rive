import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

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

export async function PUT(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const defaultCurrency = (text(body?.defaultCurrency, 3) || "USD").toUpperCase();
  const invoicePrefix = (text(body?.invoicePrefix, 16) || "INV").replace(/[^A-Za-z0-9-]/g, "");
  if (!/^[A-Z]{3}$/.test(defaultCurrency) || !invoicePrefix) return NextResponse.json({ success: false, message: "Use a valid currency and invoice prefix." }, { status: 400 });
  const profile = await prisma.invoiceProfile.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, businessName: text(body?.businessName, 180), contactName: text(body?.contactName, 160), email: text(body?.email, 254), phone: text(body?.phone, 80), address: text(body?.address, 1_000), taxId: text(body?.taxId, 120), logoUrl: text(body?.logoUrl, 1_000), defaultCurrency, invoicePrefix, paymentInstructions: text(body?.paymentInstructions, 2_000), defaultTerms: text(body?.defaultTerms, 2_000) },
    update: { businessName: text(body?.businessName, 180), contactName: text(body?.contactName, 160), email: text(body?.email, 254), phone: text(body?.phone, 80), address: text(body?.address, 1_000), taxId: text(body?.taxId, 120), logoUrl: text(body?.logoUrl, 1_000), defaultCurrency, invoicePrefix, paymentInstructions: text(body?.paymentInstructions, 2_000), defaultTerms: text(body?.defaultTerms, 2_000) },
  });
  return NextResponse.json({ success: true, profile });
}
