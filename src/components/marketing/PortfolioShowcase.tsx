import PortfolioRenderer from "@/components/portfolio/PortfolioRenderer";
import { samplePortfolioContent } from "@/content/marketing/portfolio";
import type { PortfolioTheme } from "@/utils/portfolio";

const sampleTheme: PortfolioTheme = {
  accent: "#d0341c",
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
