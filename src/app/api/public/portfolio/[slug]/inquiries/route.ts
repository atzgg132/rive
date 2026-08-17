import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { sendPortfolioInquiryEmail } from "@/utils/email";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { isPortfolioPublished, mergePortfolioContent } from "@/utils/portfolio";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const ip = getRequestIp(request);
  const throttled = NextResponse.json(
    { success: false, message: "You’ve sent several enquiries. Please try again later." },
    { status: 429 },
  );

  /* Public, unauthenticated, enumerable by slug, and it sends mail from our
     own domain — exactly what the durable limiter exists for. The process-local
     one reset on every deploy and was not a boundary worth relying on here.
     The per-slug ceiling is the one that matters: it bounds how much mail a
     single portfolio owner can be sent no matter how many addresses the sender
     appears to come from. */
  if (!await durableRateLimit(`portfolio-inquiry:slug:${slug}`, 20, 60 * 60 * 1000)) return throttled;
  if (!await durableRateLimit(`portfolio-inquiry:${slug}:${hashRequestValue(ip)}`, 4, 60 * 60 * 1000)) return throttled;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const projectType = typeof body?.projectType === "string" ? body.projectType.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const website = typeof body?.website === "string" ? body.website.trim() : "";

  // A hidden honeypot quietly accepts bot submissions without delivering them.
  if (website) return NextResponse.json({ success: true });

  if (
    name.length < 2 ||
    name.length > 120 ||
    !emailPattern.test(email) ||
    email.length > 320 ||
    projectType.length < 2 ||
    projectType.length > 120 ||
    message.length < 10 ||
    message.length > 5_000
  ) {
    return NextResponse.json(
      { success: false, message: "Please complete every field with valid details." },
      { status: 400 },
    );
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { slug },
    select: { status: true, content: true },
  });
  if (!portfolio || !isPortfolioPublished(portfolio.status)) {
    return NextResponse.json({ success: false, message: "This portfolio is not available." }, { status: 404 });
  }

  const content = mergePortfolioContent(portfolio.content);
  if (!content.contactEmail) {
    return NextResponse.json(
      { success: false, message: "This portfolio is not accepting enquiries yet." },
      { status: 409 },
    );
  }

  const result = await sendPortfolioInquiryEmail({
    to: content.contactEmail,
    portfolioName: content.name,
    visitorName: name,
    visitorEmail: email,
    projectType,
    message,
  });
  if (!result.sent) {
    return NextResponse.json(
      { success: false, message: `Delivery failed. Please email ${content.contactEmail} directly.` },
      { status: 503 },
    );
  }

  return NextResponse.json({ success: true });
}
