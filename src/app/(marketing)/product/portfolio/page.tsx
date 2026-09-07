import { EditorialProductPage } from "@/components/marketing/EditorialProductPage";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Publish your client work with Portfolio Studio | Rive", "Build a public portfolio, present your services, and receive enquiries with Rive.", "/product/portfolio");

export default function PortfolioProductPage() {
  return <EditorialProductPage kind="portfolio" />;
}
