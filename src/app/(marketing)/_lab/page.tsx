import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnimatedBentoCard } from "@/components/marketing/AnimatedBentoCard";
import { CodeSnippetBlock } from "@/components/marketing/CodeSnippetBlock";
import { MetricTicker } from "@/components/marketing/MetricTicker";
import { MarketingMotionProvider } from "@/components/marketing/MarketingMotionProvider";
import { RevealOnScroll, BentoGrid } from "@/components/marketing/RevealOnScroll";
import { GlassPanel, GlowingBadge, GradientText, HairlineDivider, LogoMarquee, MarketingButton } from "@/components/marketing/primitives";
import { MarketingProductScene } from "@/components/marketing/product/SceneRegistry";
import { SectionShell } from "@/components/marketing/shells";

export const metadata: Metadata = {
  title: "Marketing component lab — Rive",
  robots: { index: false, follow: false },
};

export default function MarketingLabPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <MarketingMotionProvider>
      <SectionShell className="pb-14 pt-36 sm:pt-44">
        <GlowingBadge pulse>DEV-ONLY COMPONENT LAB</GlowingBadge>
        <h1 className="mt-7 text-5xl font-black tracking-[-0.055em] text-white sm:text-7xl">One surface. <GradientText>Every primitive.</GradientText></h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">This route exists for local visual review and is excluded from production and the sitemap.</p>
      </SectionShell>
      <HairlineDivider />
      <SectionShell>
        <BentoGrid>
          <AnimatedBentoCard className="sm:col-span-2"><p className="font-mono text-xs uppercase tracking-[0.16em] text-blue-300">Metric ticker</p><p className="mt-12 text-6xl font-black text-white"><MetricTicker value={1247} /></p><p className="mt-3 text-slate-400">Records ready after review.</p></AnimatedBentoCard>
          <GlassPanel tier={1} className="p-6"><p className="font-mono text-xs text-slate-400">ELEVATION 01</p></GlassPanel>
          <GlassPanel tier={2} className="p-6"><p className="font-mono text-xs text-slate-400">ELEVATION 02</p></GlassPanel>
          <GlassPanel tier={3} className="p-6"><p className="font-mono text-xs text-blue-300">ELEVATION 03</p></GlassPanel>
        </BentoGrid>
        <RevealOnScroll className="mt-10 grid gap-8 lg:grid-cols-2">
          <CodeSnippetBlock label="connected-record.json" language="JSON" typewriter code={'{\n  "client": "Northstar",\n  "work": "Product redesign",\n  "invoice": "INV-1042"\n}'} />
          <MarketingProductScene visual={{ kind: "dashboard", props: { title: "Good morning, Arnav", metrics: [{ label: "Paid", value: "18400", tone: "emerald" }, { label: "Margin", value: "62", tone: "blue" }, { label: "Outstanding", value: "3200", tone: "rose" }], activity: ["INV-1042 marked paid", "Northstar milestone moved"] } }} />
        </RevealOnScroll>
        <div className="mt-10 flex flex-wrap gap-4"><MarketingButton href="#lab-marquee">Primary action</MarketingButton><MarketingButton href="#lab-marquee" variant="secondary">Secondary action</MarketingButton></div>
      </SectionShell>
      <div id="lab-marquee" className="border-y border-white/[0.07] py-6"><LogoMarquee label="Component lab marquee" items={["CLIENT", "WORK", "MONEY", "PROOF"]} /></div>
    </MarketingMotionProvider>
  );
}
