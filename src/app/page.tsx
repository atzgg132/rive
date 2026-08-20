import { BarChart3, CheckCircle2, FileUp, Link2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import AISection from "@/components/AISection";
import RemitSection from "@/components/RemitSection";
import Faq from "@/components/Faq";
import Pricing from "@/components/Pricing";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import MarketingPortfolioSection from "@/components/MarketingPortfolioSection";
import MarketingAgreementsSection from "@/components/MarketingAgreementsSection";
import MarketingConnectionsSection from "@/components/MarketingConnectionsSection";

export const dynamic = "force-dynamic";

export default function Home() {
  // Keep the public product story consistent across environments. The actual
  // Agreements workflow remains gated independently in auth/session and API
  // routes, but a dev-only runtime flag must not make the marketing page fall
  // back to an older, incomplete layout.
  const marketingAgreementsEnabled = true;
  return <main className="min-h-screen overflow-hidden bg-background">
    <Navbar />
    <Hero />
    <Features agreementsEnabled={marketingAgreementsEnabled} />
    <ConnectedProductSection agreementsEnabled={marketingAgreementsEnabled} />
    <MarketingConnectionsSection />
    {marketingAgreementsEnabled && <MarketingAgreementsSection />}
    <MarketingPortfolioSection />
    <AISection />
    <RemitSection />
    <Faq agreementsEnabled={marketingAgreementsEnabled} />
    <Pricing agreementsEnabled={marketingAgreementsEnabled} />
    <FinalCTA />
    <Footer />
  </main>;
}

function ConnectedProductSection({ agreementsEnabled }: { agreementsEnabled: boolean }) {
  return <section className="relative overflow-hidden border-y border-slate-200/80 bg-white py-24 dark:border-slate-800 dark:bg-slate-950 sm:py-32">
    <div className="mx-auto max-w-7xl px-5 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-600 dark:text-blue-400">The connected workspace</p><h2 className="mt-4 max-w-2xl text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-slate-900 dark:text-white">Every part of the business, finally pulling in the same direction.</h2></div><p className="max-w-xl text-lg leading-8 text-slate-500 dark:text-slate-400">Your client record connects to projects{agreementsEnabled ? " and Agreements" : ""}. Projects connect to dates, tasks, invoices, and expenses. Rive turns those relationships into a workspace that helps you decide what to do next.</p></div>
      <div className="mt-14 grid gap-4 md:grid-cols-2"><ConnectedCard icon={<Link2 />} title="Work stays connected" text={agreementsEnabled ? "Clients, contracts, projects, tasks, deadlines, invoices, and expenses share the same context." : "Clients, projects, tasks, deadlines, invoices, and expenses share the same context."} /><ConnectedCard icon={<BarChart3 />} title="Signals replace guesswork" text="See revenue, collections, margins, workload, upcoming work, and portfolio engagement at a glance." /><ConnectedCard icon={<FileUp />} title="Start with momentum" text="Import CSV or XLSX exports, subscribe to an Apple Calendar feed, and start with a guided first workflow instead of an empty dashboard." /><ConnectedCard icon={<CheckCircle2 />} title="Nothing important slips" text="See overdue payments, approaching deadlines, and work that needs your attention before it becomes a problem." /></div>
    </div>
  </section>;
}

function ConnectedCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <article className="rounded-3xl border border-blue-100 bg-blue-50/70 p-7 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300 sm:p-9"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 shadow-sm dark:bg-slate-900/70">{icon}</div><h3 className="mt-12 text-2xl font-black text-slate-900 dark:text-white">{title}</h3><p className="mt-3 max-w-md text-sm leading-7 text-slate-600 dark:text-slate-300">{text}</p></article>;
}
