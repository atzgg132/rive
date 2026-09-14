import PortfolioRenderer from "@/components/portfolio/PortfolioRenderer";
import { samplePortfolioContent } from "@/content/marketing/portfolio";
import { PORTFOLIO_TEMPLATES, type PortfolioTheme } from "@/utils/portfolio";

const sampleTheme: PortfolioTheme = {
  accent: "#1d4ed8",
  mode: "light",
  radius: "soft",
};

export function PortfolioShowcase() {
  return (
    <div data-testid="portfolio-showcase">
      <PortfolioRenderer content={samplePortfolioContent} theme={sampleTheme} templateKey="minimal-pro" headingLevel="h2" />
    </div>
  );
}

/** One record set in one template — the same sample content rendered by the
 * real public renderer at that template's default accent. Used inside a
 * SpecimenFrame, so it stays a document: callers keep it inert.
 * `opening` hides every toggleable section — a real configuration — so the
 * plate carries the page's opening where the full document runs too long. */
export function PortfolioSpecimen({ templateKey, opening = false }: { templateKey: (typeof PORTFOLIO_TEMPLATES)[number]["key"]; opening?: boolean }) {
  const accent = PORTFOLIO_TEMPLATES.find((template) => template.key === templateKey)?.accent ?? sampleTheme.accent;
  const content = opening
    ? { ...samplePortfolioContent, sections: samplePortfolioContent.sections.map((section) => ({ ...section, visible: false })) }
    : samplePortfolioContent;
  return <PortfolioRenderer content={content} theme={{ ...sampleTheme, accent }} templateKey={templateKey} headingLevel="h3" />;
}
