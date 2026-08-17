import { createHash } from "crypto";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import PortfolioCaseStudy from "@/components/portfolio/PortfolioCaseStudy";
import { prisma } from "@/utils/db";
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

  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") || "";
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const visitorHash = createHash("sha256").update(`${ip}:${userAgent}:${new Date().toISOString().slice(0, 10)}`).digest("hex");
  await prisma.portfolioView.create({
    data: {
      portfolioId: result.portfolio.id,
      visitorHash,
      referrer: requestHeaders.get("referer")?.slice(0, 500) || null,
      deviceType: /mobile|android|iphone|ipad/i.test(userAgent) ? "mobile" : /tablet/i.test(userAgent) ? "tablet" : "desktop",
    },
  });

  const theme = (result.portfolio.theme && typeof result.portfolio.theme === "object" ? result.portfolio.theme : DEFAULT_PORTFOLIO_THEME) as PortfolioTheme;
  return <PortfolioCaseStudy content={result.content} project={result.project} portfolioSlug={slug} theme={theme} />;
}
