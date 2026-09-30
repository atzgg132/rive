import { EditorialProductPage } from "@/components/marketing/EditorialProductPage";
import { marketingMetadata } from "@/lib/marketingMetadata";
import { siteRouteMetadata } from "@/content/site/metadata";

const v2 = siteRouteMetadata["/product/clients-projects"];

export const metadata =
  process.env.MARKETING_SITE_V2 === "1"
    ? marketingMetadata(v2.title, v2.description, "/product/clients-projects")
    : marketingMetadata("Client and project management for independent businesses | Rive", "Manage client details, projects, tasks, milestones, and deadlines in Rive.", "/product/clients-projects");

export default async function ClientsProjectsPage() {
  // Must stay an inline `process.env` comparison: see `env` in next.config.ts.
  if (process.env.MARKETING_SITE_V2 === "1") {
    const { SiteProductPage } = await import("@/components/site/product/SiteProductPage");
    return <SiteProductPage slug="clients-projects" />;
  }
  return <EditorialProductPage kind="clients" />;
}
