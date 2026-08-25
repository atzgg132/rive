import { pressBrandAssets, pressContent } from "@/content/marketing/pages";
import { GlassPanel } from "@/components/marketing/primitives";
import { MarketingPage, SectionShell } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive press room", "Verified company facts, approved brand assets, boilerplate, and media contact.", "/press");

export default function PressPage() {
  return (
    <>
      <MarketingPage content={pressContent} />
      <SectionShell className="marketing-alt-band">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight tracking-[-0.04em] text-foreground sm:text-5xl">Brand assets</h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground">The wordmarks and logos we actually ship. Open or download the SVG. There is no separate PNG or PDF kit.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {pressBrandAssets.map((asset) => (
              <GlassPanel key={asset.href} tier={2} className="flex min-h-44 flex-col p-6 sm:p-7">
                <h3 className="mt-auto text-xl font-bold tracking-[-0.025em] text-foreground">{asset.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{asset.body}</p>
                <a href={asset.href} download className="marketing-focus mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80">
                  Open / download
                </a>
              </GlassPanel>
            ))}
          </div>
        </div>
      </SectionShell>
    </>
  );
}
