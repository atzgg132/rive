import { MarketingHome } from "@/components/marketing/MarketingHome";
import { marketingMetadata } from "@/lib/marketingMetadata";
import { siteRouteMetadata } from "@/content/site/metadata";

export const metadata =
  process.env.MARKETING_SITE_V2 === "1"
    ? marketingMetadata(siteRouteMetadata["/"].title, siteRouteMetadata["/"].description, "/")
    : marketingMetadata(
        "Rive — Multiple clients. One clear picture.",
        "Manage clients, projects, agreements, invoices, and expenses in one workspace built for independent service businesses.",
        "/",
      );

export default async function MarketingHomePage() {
  // Must stay an inline `process.env` comparison: see `env` in next.config.ts.
  if (process.env.MARKETING_SITE_V2 === "1") {
    const { SiteHome } = await import("@/components/site/home/SiteHome");
    return <SiteHome />;
  }
  return <MarketingHome />;
}
