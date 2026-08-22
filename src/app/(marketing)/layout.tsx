import type { ReactNode } from "react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { AuroraGlow } from "@/components/marketing/AuroraGlow";
import { GridField, NoiseOverlay } from "@/components/marketing/primitives";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div data-surface="marketing" className="relative overflow-x-clip bg-[#05070c] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <GridField />
        <AuroraGlow className="-left-48 -top-40 h-[42rem] w-[42rem]" strength={0.035} />
        <AuroraGlow className="-right-64 top-[38rem] h-[36rem] w-[36rem] opacity-60" strength={-0.025} />
        <NoiseOverlay />
      </div>
      <SiteHeader />
      <main id="main-content" className="relative min-h-screen">{children}</main>
      <SiteFooter />
    </div>
  );
}
