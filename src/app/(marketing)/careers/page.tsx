import { careersContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Careers at Rive", "Help build dependable operating software for people whose name is on the work.", "/careers");

export default function CareersPage() {
  return <MarketingPage content={careersContent} />;
}
