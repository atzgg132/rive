import { blogContent } from "@/content/marketing/pages";
import { MarketingPage } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive field notes", "Notes on the systems, decisions, and hidden coordination cost behind independent client work.", "/blog");

export default function BlogPage() {
  return <MarketingPage content={blogContent} />;
}
