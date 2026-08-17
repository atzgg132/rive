import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { portfolioViewRequestContext, recordPortfolioView } from "@/utils/portfolioViews";
import { getPublicPortfolioContent, isPortfolioPublished } from "@/utils/portfolio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const portfolio = await prisma.portfolio.findUnique({ where: { slug } });
    if (!portfolio || !isPortfolioPublished(portfolio.status)) {
      return NextResponse.json({ success: false, message: "Portfolio not found." }, { status: 404 });
    }

    /* Shares the recorder — and therefore the de-duplication window — with the
       rendered page, so a client that reads this route right after loading
       /p/[slug] contributes one view rather than two. */
    const viewContext = portfolioViewRequestContext(req.headers, {
      previewSearchParam: req.nextUrl.searchParams.get("preview"),
    });
    after(async () => {
      await recordPortfolioView({
        ...viewContext,
        portfolioId: portfolio.id,
        ownerUserId: portfolio.userId,
        pageType: "portfolio",
      });
    });

    return NextResponse.json({
      success: true,
      portfolio: {
        slug: portfolio.slug,
        templateKey: portfolio.templateKey,
        content: getPublicPortfolioContent(portfolio.content),
        theme: portfolio.theme,
        seo: portfolio.seo,
      },
    });
  } catch (error) {
    console.error("Public portfolio error:", error);
    return NextResponse.json({ success: false, message: "Portfolio unavailable." }, { status: 500 });
  }
}
