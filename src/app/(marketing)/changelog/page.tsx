import { changelogContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive changelog — What has shipped", "A factual record of what is live in the Rive open beta.", "/changelog");

export default async function ChangelogPage() {
  // Must stay an inline `process.env` comparison: see `env` in next.config.ts.
  if (process.env.MARKETING_SITE_V2 === "1") {
    const { SiteContentPage } = await import("@/components/site/pages/SiteContentPage");
    return <SiteContentPage content={changelogContent} kind="changelog" />;
  }
  return <MarketingPage content={changelogContent} />;
}
