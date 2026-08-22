import { pressContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive press room", "Verified company facts, approved brand assets, boilerplate, and media contact.", "/press");

export default function PressPage() {
  return <MarketingPage content={pressContent} />;
}
