import type { Metadata } from "next";
import { createHash } from "crypto";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/utils/db";
import PortfolioRenderer from "@/components/portfolio/PortfolioRenderer";
import { normalizePortfolioReferrer } from "@/utils/portfolioAnalytics";
import { isPortfolioPublished, mergePortfolioContent, DEFAULT_PORTFOLIO_THEME, type PortfolioTheme } from "@/utils/portfolio";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

const loadPortfolio = cache(async (slug: string) => {
  const portfolio = await prisma.portfolio.findUnique({ where: { slug } });
  if (!portfolio || !isPortfolioPublished(portfolio.status)) return null;
  return portfolio;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const portfolio = await loadPortfolio(slug);
  if (!portfolio) return { title: "portfolio not found · rive." };
  const content = mergePortfolioContent(portfolio.content);
  const seo = (portfolio.seo && typeof portfolio.seo === "object" ? portfolio.seo : {}) as { title?: string; description?: string; indexable?: boolean };
  return {
    title: seo.title || `${content.name} · portfolio`,
    description: seo.description || content.bio,
    robots: seo.indexable === false ? { index: false, follow: false } : undefined,
    openGraph: { title: seo.title || `${content.name} · portfolio`, description: seo.description || content.bio, type: "website" },
  };
}

export default async function PublicPortfolioPage({ params }: Props) {
  const { slug } = await params;
  const portfolio = await loadPortfolio(slug);
  if (!portfolio) notFound();

  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") || "";
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const visitorHash = createHash("sha256").update(`${ip}:${userAgent}:${new Date().toISOString().slice(0, 10)}`).digest("hex");
  const referrer = normalizePortfolioReferrer(requestHeaders.get("referer"));
  const deviceType = /mobile|android|iphone|ipad/i.test(userAgent) ? "mobile" : /tablet/i.test(userAgent) ? "tablet" : "desktop";
  after(async () => {
    await prisma.portfolioView.create({
      data: { portfolioId: portfolio.id, visitorHash, referrer, deviceType },
    });
  });

  const theme = (portfolio.theme && typeof portfolio.theme === "object" ? portfolio.theme : DEFAULT_PORTFOLIO_THEME) as PortfolioTheme;
  return <PortfolioRenderer content={mergePortfolioContent(portfolio.content)} theme={theme} templateKey={portfolio.templateKey} portfolioSlug={slug} />;
}
