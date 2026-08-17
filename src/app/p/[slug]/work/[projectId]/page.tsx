import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import PortfolioCaseStudy from "@/components/portfolio/PortfolioCaseStudy";
import { prisma } from "@/utils/db";
import { portfolioViewRequestContext, recordPortfolioView } from "@/utils/portfolioViews";
import { DEFAULT_PORTFOLIO_THEME, getPublicPortfolioContent, isPortfolioPublished, type PortfolioTheme } from "@/utils/portfolio";

type Props = { params: Promise<{ slug: string; projectId: string }> };

async function loadCaseStudy(slug: string, projectId: string) {
  const portfolio = await prisma.portfolio.findUnique({ where: { slug } });
  if (!portfolio || !isPortfolioPublished(portfolio.status)) return null;
  /* Public content already excludes private projects and anything belonging to
     a hidden practice, so a direct case-study URL cannot reach either. */
  const content = getPublicPortfolioContent(portfolio.content);
  const project = content.projects.find((item) => item.id === projectId);
  if (!project) return null;
  return { portfolio, content, project };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, projectId } = await params;
  const result = await loadCaseStudy(slug, projectId);
  if (!result) return { title: "Case study not found · Rive." };
  const { content, project } = result;
  return {
    title: `${project.title} · ${content.name}`,
    description: project.description || project.outcome || `A project by ${content.name}.`,
    openGraph: {
      title: `${project.title} · ${content.name}`,
      description: project.description || project.outcome || `A project by ${content.name}.`,
      type: "article",
      // HTTPS only, matching what the content validator now accepts. Scrapers
      // drop an http:// og:image anyway, so emitting one only produces a card
      // with a broken preview.
      images: project.imageUrl && /^https:\/\//i.test(project.imageUrl) ? [{ url: project.imageUrl, alt: project.title }] : undefined,
    },
  };
}

export default async function PortfolioCaseStudyPage({ params }: Props) {
  const { slug, projectId } = await params;
  const result = await loadCaseStudy(slug, projectId);
  if (!result) notFound();

  /* Attributed to the project so per-case-study interest is measurable. The id
     is the one inside the portfolio content, which is what makes the figure
     survive a later rename — and `after` keeps the reader from waiting on a
     write that used to block this page's response. */
  const viewContext = portfolioViewRequestContext(await headers());
  after(async () => {
    await recordPortfolioView({
      ...viewContext,
      portfolioId: result.portfolio.id,
      ownerUserId: result.portfolio.userId,
      pageType: "project",
      projectId: result.project.id,
    });
  });

  const theme = (result.portfolio.theme && typeof result.portfolio.theme === "object" ? result.portfolio.theme : DEFAULT_PORTFOLIO_THEME) as PortfolioTheme;
  return <PortfolioCaseStudy content={result.content} project={result.project} portfolioSlug={slug} theme={theme} />;
}
