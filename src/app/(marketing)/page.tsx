import { MarketingHome } from "@/components/marketing/MarketingHome";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata(
  "Rive — Your business should not need you as middleware",
  "Connect clients, projects, Agreements, invoices, expenses, calendars, imports, and portfolio proof in one operating workspace.",
  "/",
);

export default function MarketingHomePage() {
  return <MarketingHome />;
}
