import { communityContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive community", "A working group for independent professionals shaping a more connected way to run client work.", "/community");

export default function CommunityPage() {
  return <MarketingPage content={communityContent} />;
}
