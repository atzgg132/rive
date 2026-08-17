import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/utils/db";
import PortfolioRenderer from "@/components/portfolio/PortfolioRenderer";
import { portfolioViewRequestContext, recordPortfolioView } from "@/utils/portfolioViews";
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

  /* A practice page is another way into the same portfolio, not a case study,
     so it counts as a portfolio-home view. */
  const viewContext = portfolioViewRequestContext(await headers());
  after(async () => {
    await recordPortfolioView({
      ...viewContext,
      portfolioId: result.portfolio.id,
      ownerUserId: result.portfolio.userId,
      pageType: "portfolio",
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
