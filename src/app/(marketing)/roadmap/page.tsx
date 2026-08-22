import { roadmapContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive roadmap", "What is live in open beta and the reliability, connection, and portability work ahead.", "/roadmap");

export default function RoadmapPage() {
  return <MarketingPage content={roadmapContent} />;
}
