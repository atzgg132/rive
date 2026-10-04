import { aboutContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("About Rive — The client record for independent designers.", "Meet the team building the client record for independent designers.", "/about");

export default function AboutPage() {
  return <MarketingPage content={aboutContent} />;
}
