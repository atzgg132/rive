import { roadmapContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive roadmap", "What is live in open beta and the reliability, connection, and portability work ahead.", "/roadmap");

export default async function RoadmapPage() {
  // Must stay an inline `process.env` comparison: see `env` in next.config.ts.
  if (process.env.MARKETING_SITE_V2 === "1") {
    const { SiteContentPage } = await import("@/components/site/pages/SiteContentPage");
    return <SiteContentPage content={roadmapContent} kind="roadmap" />;
  }
  return <MarketingPage content={roadmapContent} />;
}
