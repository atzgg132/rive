import type { Metadata } from "next";
import { createHash } from "crypto";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/utils/db";
import PortfolioRenderer from "@/components/portfolio/PortfolioRenderer";
import {
  DEFAULT_PORTFOLIO_THEME,
  getVisiblePractices,
  isPortfolioPublished,
  mergePortfolioContent,
  type PortfolioTheme,
} from "@/utils/portfolio";

type Props = { params: Promise<{ slug: string; practiceSlug: string }> };

export const dynamic = "force-dynamic";

/* The static `work` segment resolves before this dynamic one, so a practice
   can never shadow a case-study URL. Practice slugs are validated against the
   same reserved list when they are saved. */
const loadPractice = cache(async (slug: string, practiceSlug: string) => {
  const portfolio = await prisma.portfolio.findUnique({ where: { slug } });
  if (!portfolio || !isPortfolioPublished(portfolio.status)) return null;
  const content = mergePortfolioContent(portfolio.content);
  const practice = getVisiblePractices(content).find((item) => item.slug === practiceSlug);
  if (!practice) return null;
  return { portfolio, content, practice };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, practiceSlug } = await params;
  const result = await loadPractice(slug, practiceSlug);
  if (!result) return { title: "Portfolio not found · rive." };
  const { content, practice } = result;
  const title = `${practice.name} · ${content.name}`;
  const description = practice.description || practice.tagline || content.bio;
  const seo = (result.portfolio.seo && typeof result.portfolio.seo === "object" ? result.portfolio.seo : {}) as { indexable?: boolean };
  return {
    title,
    description,
    robots: seo.indexable === false ? { index: false, follow: false } : undefined,
    alternates: { canonical: `/p/${slug}/${practice.slug}` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function PortfolioPracticePage({ params }: Props) {
  const { slug, practiceSlug } = await params;
  const result = await loadPractice(slug, practiceSlug);
  if (!result) notFound();

  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") || "";
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const visitorHash = createHash("sha256").update(`${ip}:${userAgent}:${new Date().toISOString().slice(0, 10)}`).digest("hex");
  const referrer = requestHeaders.get("referer")?.slice(0, 500) || null;
  const deviceType = /mobile|android|iphone|ipad/i.test(userAgent) ? "mobile" : /tablet/i.test(userAgent) ? "tablet" : "desktop";
  after(async () => {
    await prisma.portfolioView.create({
      data: { portfolioId: result.portfolio.id, visitorHash, referrer, deviceType },
    });
  });

  const theme = (result.portfolio.theme && typeof result.portfolio.theme === "object" ? result.portfolio.theme : DEFAULT_PORTFOLIO_THEME) as PortfolioTheme;
  return (
    <PortfolioRenderer
      content={result.content}
      theme={theme}
      templateKey={result.portfolio.templateKey}
      portfolioSlug={slug}
      activePracticeSlug={result.practice.slug}
    />
  );
}
