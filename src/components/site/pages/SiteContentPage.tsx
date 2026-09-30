import type { MarketingPageContent } from "@/content/marketing/pages";

export function SiteContentPage({ content }: { content: MarketingPageContent; kind: "about" | "changelog" | "roadmap" }) {
  return <section data-stub="content-page" style={{ minHeight: "80vh" }}>{content.title}</section>;
}
