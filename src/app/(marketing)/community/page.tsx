import { communityContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive community", "Email a broken handoff via /contact so operating reality can reach the people shipping Rive. There is no live community product.", "/community");

export default function CommunityPage() {
  return <MarketingPage content={communityContent} />;
}
