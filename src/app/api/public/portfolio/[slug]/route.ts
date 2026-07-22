import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { isPortfolioPublished, mergePortfolioContent } from "@/utils/portfolio";

function deviceFromUserAgent(userAgent: string): string {
  if (/mobile|android|iphone|ipad/i.test(userAgent)) return "mobile";
  if (/tablet/i.test(userAgent)) return "tablet";
  return "desktop";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const portfolio = await prisma.portfolio.findUnique({ where: { slug } });
    if (!portfolio || !isPortfolioPublished(portfolio.status)) {
      return NextResponse.json({ success: false, message: "Portfolio not found." }, { status: 404 });
    }

    const userAgent = req.headers.get("user-agent") || "";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const visitorHash = createHash("sha256").update(`${ip}:${userAgent}:${new Date().toISOString().slice(0, 10)}`).digest("hex");
    const referrer = req.headers.get("referer")?.slice(0, 500) || null;
    await prisma.portfolioView.create({
      data: { portfolioId: portfolio.id, visitorHash, referrer, deviceType: deviceFromUserAgent(userAgent) },
    });

    return NextResponse.json({
      success: true,
      portfolio: {
        slug: portfolio.slug,
        templateKey: portfolio.templateKey,
        content: mergePortfolioContent(portfolio.content),
        theme: portfolio.theme,
        seo: portfolio.seo,
      },
    });
  } catch (error) {
    console.error("Public portfolio error:", error);
    return NextResponse.json({ success: false, message: "Portfolio unavailable." }, { status: 500 });
  }
}
