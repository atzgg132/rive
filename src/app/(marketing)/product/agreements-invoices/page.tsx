import { EditorialProductPage } from "@/components/marketing/EditorialProductPage";
import { marketingMetadata } from "@/lib/marketingMetadata";
import { siteRouteMetadata } from "@/content/site/metadata";

const v2 = siteRouteMetadata["/product/agreements-invoices"];

export const metadata =
  process.env.MARKETING_SITE_V2 === "1"
    ? marketingMetadata(v2.title, v2.description, "/product/agreements-invoices")
    : marketingMetadata("Agreements and invoices for client work | Rive", "Prepare agreements, record acceptance, and manage invoices alongside the client work they belong to.", "/product/agreements-invoices");

export default async function AgreementsInvoicesPage() {
  // Must stay an inline `process.env` comparison: see `env` in next.config.ts.
  if (process.env.MARKETING_SITE_V2 === "1") {
    const { SiteProductPage } = await import("@/components/site/product/SiteProductPage");
    return <SiteProductPage slug="agreements-invoices" />;
  }
  return <EditorialProductPage kind="agreements" />;
}
