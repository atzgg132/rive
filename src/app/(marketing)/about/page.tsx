import { aboutContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("About Rive — Built from the work itself", "Meet the team building a connected operating workspace for independent professionals and digital service businesses.", "/about");

export default function AboutPage() {
  return <MarketingPage content={aboutContent} />;
}
