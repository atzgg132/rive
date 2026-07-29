import { BarChart3, CheckCircle2, FileUp, Link2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import AISection from "@/components/AISection";
import GigBoard from "@/components/GigBoard";
import RemitSection from "@/components/RemitSection";
import Faq from "@/components/Faq";
import Pricing from "@/components/Pricing";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import MarketingPortfolioSection from "@/components/MarketingPortfolioSection";
import MarketingModalHost from "@/components/MarketingModalHost";

export default function Home() {
  return <main className="min-h-screen overflow-hidden bg-background">
    <Navbar />
    <Hero />
    <Features />
    <ConnectedProductSection />
    <MarketingPortfolioSection />
    <AISection />
    <GigBoard />
    <RemitSection />
    <Faq />
    <Pricing />
    <FinalCTA />
    <Footer />
    <MarketingModalHost />
  </main>;
}

function ConnectedProductSection() {
  return <section className="relative overflow-hidden border-y border-slate-200/80 bg-white py-24 dark:border-slate-800 dark:bg-slate-950 sm:py-32">
    <div className="mx-auto max-w-7xl px-5 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-600 dark:text-blue-400">The connected workspace</p><h2 className="mt-4 max-w-2xl text-4xl font-black leading-[1.03] tracking-[-.045em] text-slate-900 dark:text-white sm:text-6xl">Every part of the business, finally pulling in the same direction.</h2></div><p className="max-w-xl text-lg leading-8 text-slate-500 dark:text-slate-400">Your client record connects to the project. The project connects to dates, tasks, invoices, and expenses. Rive turns those relationships into a workspace that helps you decide what to do next.</p></div>
      <div className="mt-14 grid gap-4 md:grid-cols-2"><ConnectedCard tone="blue" icon={<Link2 />} title="Work stays connected" text="Clients, projects, tasks, deadlines, invoices, and expenses share the same context." /><ConnectedCard tone="violet" icon={<BarChart3 />} title="Signals replace guesswork" text="See revenue, collections, margins, workload, upcoming work, and portfolio engagement at a glance." /><ConnectedCard tone="emerald" icon={<FileUp />} title="Start with momentum" text="Guided onboarding helps you bring your existing work into Rive instead of starting from an empty dashboard." /><ConnectedCard tone="amber" icon={<CheckCircle2 />} title="Nothing important slips" text="See overdue payments, approaching deadlines, and work that needs your attention before it becomes a problem." /></div>
    </div>
  </section>;
}

function ConnectedCard({ tone, icon, title, text }: { tone: "blue" | "violet" | "emerald" | "amber"; icon: React.ReactNode; title: string; text: string }) {
  const styles = { blue: "border-blue-100 bg-blue-50/70 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300", violet: "border-violet-100 bg-violet-50/70 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300", emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300", amber: "border-amber-100 bg-amber-50/70 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300" }[tone];
  return <article className={`rounded-3xl border p-7 sm:p-9 ${styles}`}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 shadow-sm dark:bg-slate-900/70">{icon}</div><h3 className="mt-12 text-2xl font-black text-slate-900 dark:text-white">{title}</h3><p className="mt-3 max-w-md text-sm leading-7 text-slate-600 dark:text-slate-300">{text}</p></article>;
}
