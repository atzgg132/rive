import { ArrowRight } from "lucide-react";
import { CodeSnippetBlock } from "@/components/marketing/CodeSnippetBlock";
import { GlassPanel, MarketingButton } from "@/components/marketing/primitives";
import { IndexShell } from "@/components/marketing/shells";
import { docsContent } from "@/content/marketing/resources";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive documentation", "Learn the connected records and workflows behind Rive.", "/docs");

export default function DocsPage() {
  return (
    <IndexShell eyebrow={docsContent.eyebrow} title={docsContent.title} intro={docsContent.intro}>
      <div className="grid gap-10 lg:grid-cols-[.65fr_1.35fr] lg:items-start">
        <nav aria-label="Documentation sections" className="sticky top-28 hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 lg:grid">
          {docsContent.sections.map((section, index) => <a key={section.id} href={`#${section.id}`} className="marketing-focus rounded-xl px-3 py-3 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-400 transition hover:bg-white/[0.04] hover:text-blue-300">{String(index + 1).padStart(2, "0")} · {section.title}</a>)}
        </nav>
        <div>
          <CodeSnippetBlock label={docsContent.snippet.label} language={docsContent.snippet.language} code={docsContent.snippet.code} />
          <div className="mt-8 grid gap-4">
            {docsContent.sections.map((section) => (
              <GlassPanel key={section.id} tier={2} className="scroll-mt-28 p-6 sm:p-8" >
                <section id={section.id}>
                  <h2 className="text-2xl font-black tracking-[-0.03em] text-white">{section.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-slate-400">{section.body}</p>
                </section>
              </GlassPanel>
            ))}
          </div>
          <MarketingButton href={docsContent.cta.href} className="mt-8">{docsContent.cta.label}<ArrowRight className="ml-2 h-4 w-4" /></MarketingButton>
        </div>
      </div>
    </IndexShell>
  );
}
