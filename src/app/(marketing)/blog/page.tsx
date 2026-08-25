import { blogContent } from "@/content/marketing/pages";
import { GlassPanel, MarketingButton } from "@/components/marketing/primitives";
import { MarketingPage, SectionShell } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive field notes", "Forthcoming notes on the systems, decisions, and hidden coordination cost behind independent client work.", "/blog");

export default function BlogPage() {
  return (
    <>
      <MarketingPage content={blogContent} />
      <SectionShell className="marketing-alt-band pt-8">
        <GlassPanel tier={2} className="p-8 sm:p-10">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-foreground">No field notes yet</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">This page is a forthcoming home for notes on client trust and operating context. There are no articles to open. The guides and the product are live today.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <MarketingButton href="/guides">Read the guides</MarketingButton>
            <MarketingButton href="/#product" variant="secondary">See the product</MarketingButton>
          </div>
        </GlassPanel>
      </SectionShell>
    </>
  );
}
