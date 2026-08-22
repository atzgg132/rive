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
        <h1 className="mt-7 text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-7xl">{apiReferenceContent.title}</h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300">{apiReferenceContent.intro}</p>
        <p className="mt-6 inline-flex items-center gap-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-amber-300"><Braces className="h-4 w-4" />{apiReferenceContent.notice}</p>
      </div>
      <div className="mt-14 grid gap-3">
        {apiReferenceContent.endpoints.map((endpoint) => (
          <GlassPanel key={`${endpoint.method}-${endpoint.path}`} tier={2} className="grid gap-3 p-5 sm:grid-cols-[5rem_18rem_1fr] sm:items-center sm:gap-5">
            <span className={`w-fit rounded-lg border px-2.5 py-1 font-mono text-[0.62rem] font-black ${endpoint.method === "GET" ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-300" : "border-blue-300/20 bg-blue-300/[0.07] text-blue-300"}`}>{endpoint.method}</span>
            <code className="break-all font-mono text-xs font-semibold text-white">{endpoint.path}</code>
            <p className="text-sm leading-6 text-slate-400">{endpoint.description}</p>
          </GlassPanel>
        ))}
      </div>
      <MarketingButton href={apiReferenceContent.cta.href} className="mt-8">{apiReferenceContent.cta.label}<ArrowRight className="ml-2 h-4 w-4" /></MarketingButton>
    </SectionShell>
  );
}
