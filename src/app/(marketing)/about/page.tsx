import { aboutContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("About Rive — Built from the work itself", "Meet the team building a connected operating workspace for independent professionals and digital service businesses.", "/about");

export default async function AboutPage() {
  // Must stay an inline `process.env` comparison: see `env` in next.config.ts.
  if (process.env.MARKETING_SITE_V2 === "1") {
    const { SiteContentPage } = await import("@/components/site/pages/SiteContentPage");
    return <SiteContentPage content={aboutContent} kind="about" />;
  }
  return <MarketingPage content={aboutContent} />;
}
