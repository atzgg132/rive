import { ArrowRight, Braces } from "lucide-react";
import { GlassPanel, GlowingBadge, MarketingButton } from "@/components/marketing/primitives";
import { SectionShell } from "@/components/marketing/shells";
import { apiReferenceContent } from "@/content/marketing/resources";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive application API reference", "A factual map of the authenticated routes behind the Rive workspace.", "/api-reference");

export default function ApiReferencePage() {
  return (
    <SectionShell className="pb-28 pt-36 sm:pt-44">
      <div className="max-w-5xl">
        <GlowingBadge>{apiReferenceContent.eyebrow}</GlowingBadge>
        <h1 className="mt-7 text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em] text-foreground sm:text-7xl">{apiReferenceContent.title}</h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-muted-foreground">{apiReferenceContent.intro}</p>
        <p className="mt-6 inline-flex items-center gap-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-warning"><Braces className="h-4 w-4" />{apiReferenceContent.notice}</p>
      </div>
      <div className="mt-14 grid gap-3">
        {apiReferenceContent.endpoints.map((endpoint) => (
          <GlassPanel key={`${endpoint.method}-${endpoint.path}`} tier={2} className="grid gap-3 p-5 sm:grid-cols-[5rem_18rem_1fr] sm:items-center sm:gap-5">
            <span className={`w-fit rounded-lg border px-2.5 py-1 font-mono text-[0.62rem] font-black ${endpoint.method === "GET" ? "border-success/20 bg-success/10 text-success" : "border-primary/20 bg-primary/10 text-primary"}`}>{endpoint.method}</span>
            <code className="break-all font-mono text-xs font-semibold text-foreground">{endpoint.path}</code>
            <p className="text-sm leading-6 text-muted-foreground">{endpoint.description}</p>
          </GlassPanel>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <MarketingButton href={apiReferenceContent.cta.href}>{apiReferenceContent.cta.label}<ArrowRight className="ml-2 h-4 w-4" /></MarketingButton>
      </div>
    </SectionShell>
  );
}
