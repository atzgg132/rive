import { changelogContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive changelog — What shipped", "A factual record of what is live in the Rive open beta.", "/changelog");

export default function ChangelogPage() {
  return <MarketingPage content={changelogContent} />;
}
