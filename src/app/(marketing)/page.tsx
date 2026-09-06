import { MarketingHome } from "@/components/marketing/MarketingHome";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata(
  "Rive — One workspace for every moving part",
  "The operating system for independent work. Connect clients, projects, agreements, invoices, expenses, calendar, imports, and portfolio proof in one workspace.",
  "/",
);

export default function MarketingHomePage() {
  return <MarketingHome />;
}
