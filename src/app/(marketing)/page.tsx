import { MarketingHome } from "@/components/marketing/MarketingHome";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata(
  "Rive — The client record for independent designers.",
  "The client record for independent designers. Agree the scope. Send the invoice. Show the work.",
  "/",
);

export default function MarketingHomePage() {
  return <MarketingHome />;
}
