import { EditorialProductPage } from "@/components/marketing/EditorialProductPage";
import { marketingMetadata } from "@/lib/marketingMetadata";
import { siteRouteMetadata } from "@/content/site/metadata";

const v2 = siteRouteMetadata["/product/portfolio"];

export const metadata =
  process.env.MARKETING_SITE_V2 === "1"
    ? marketingMetadata(v2.title, v2.description, "/product/portfolio")
    : marketingMetadata("Publish your client work with Portfolio Studio | Rive", "Build a public portfolio, present your services, and receive enquiries with Rive.", "/product/portfolio");

export default async function PortfolioProductPage() {
  // Must stay an inline `process.env` comparison: see `env` in next.config.ts.
  if (process.env.MARKETING_SITE_V2 === "1") {
    const { SiteProductPage } = await import("@/components/site/product/SiteProductPage");
    return <SiteProductPage slug="portfolio" />;
  }
  return <EditorialProductPage kind="portfolio" />;
}
