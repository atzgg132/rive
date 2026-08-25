import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { GlassPanel, GlowingBadge, MarketingButton } from "@/components/marketing/primitives";
import { SectionShell } from "@/components/marketing/shells";
import { guidesContent } from "@/content/marketing/resources";
import { GUIDE_CATALOG } from "@/lib/guides";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive guides", "Learn Rive by completing a real connected-work outcome.", "/guides");

const publicGuides = [...GUIDE_CATALOG, guidesContent.agreement];

export default function GuidesPage() {
  return (
    <>
      <SectionShell className="pb-14 pt-36 sm:pt-44">
        <GlowingBadge>{guidesContent.eyebrow}</GlowingBadge>
        <h1 className="mt-7 max-w-5xl text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em] text-foreground sm:text-7xl">{guidesContent.title}</h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-muted-foreground">{guidesContent.intro}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <MarketingButton href="/docs" variant="secondary">Workspace docs</MarketingButton>
          <MarketingButton href="/api-reference" variant="secondary">Application API</MarketingButton>
        </div>
      </SectionShell>
      <SectionShell className="pt-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {publicGuides.map((guide) => (
            <GlassPanel key={guide.id} tier={2} className="flex min-h-72 flex-col p-6">
              <div className="flex items-center justify-between gap-4 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><span>{guide.flow.join(" → ")}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{guide.duration}</span></div>
              <h2 className="mt-9 text-2xl font-black tracking-[-0.03em] text-foreground">{guide.label}</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{guide.description}</p>
              <p className="mt-4 text-sm font-semibold leading-6 text-foreground">{guide.outcome}</p>
              <Link href={`/register?goal=${encodeURIComponent(guide.goal || "organize")}`} className="marketing-focus mt-auto inline-flex items-center gap-2 pt-8 text-sm font-black text-primary hover:text-primary/80">Start with this outcome<ArrowRight className="h-4 w-4" /></Link>
            </GlassPanel>
          ))}
        </div>
        <GlassPanel tier={3} className="mt-8 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-black text-foreground">{guidesContent.accountTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{guidesContent.accountBody}</p>
          <MarketingButton href={guidesContent.accountCta.href} className="mt-6">{guidesContent.accountCta.label}</MarketingButton>
        </GlassPanel>
      </SectionShell>
    </>
  );
}
