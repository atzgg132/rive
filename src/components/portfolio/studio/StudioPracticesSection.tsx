"use client";

import PortfolioPracticeEditor from "@/components/portfolio/PortfolioPracticeEditor";
import { sectionClass } from "@/components/portfolio/studio/studioStyles";
import type { PortfolioContent } from "@/utils/portfolio";

type Props = {
  content: PortfolioContent;
  slug: string;
  onUpdateContent: (update: Partial<PortfolioContent>) => void;
};

export default function StudioPracticesSection({ content, slug, onUpdateContent }: Props) {
  return (
    <section className={sectionClass}>
      <PortfolioPracticeEditor content={content} slug={slug} onChange={onUpdateContent} />
    </section>
  );
}
