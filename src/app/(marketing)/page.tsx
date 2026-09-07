import { MarketingHome } from "@/components/marketing/MarketingHome";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata(
  "Rive — Multiple clients. One clear picture.",
  "Manage clients, projects, agreements, invoices, and expenses in one workspace built for independent service businesses.",
  "/",
);

export default function MarketingHomePage() {
  return <MarketingHome />;
}
