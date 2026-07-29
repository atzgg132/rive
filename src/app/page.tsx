"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, CheckCircle2, FileUp, Globe2, Link2, Sparkles } from "lucide-react";
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
import Modal from "@/components/Modal";

export default function Home() {
  const [modal, setModal] = useState<{ open: boolean; type: "login" | "waitlist" | "demo" }>({ open: false, type: "waitlist" });

  useEffect(() => {
    const handleOpen = (event: Event) => setModal({ open: true, type: (event as CustomEvent).detail });
    window.addEventListener("open-modal", handleOpen);
    return () => window.removeEventListener("open-modal", handleOpen);
  }, []);

  return <main className="min-h-screen overflow-hidden bg-background">
    <Navbar />
    <Hero />
    <Features />
    <ConnectedProductSection />
    <PortfolioSection />
    <AISection />
    <GigBoard />
    <RemitSection />
    <Faq />
    <Pricing />
    <FinalCTA />
    <Footer />
    <Modal isOpen={modal.open} onClose={() => setModal((state) => ({ ...state, open: false }))} type={modal.type} />
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

function PortfolioSection() {
  return <section className="relative overflow-hidden bg-[#edf4ff] py-24 dark:bg-[#0b172b] sm:py-32" id="portfolio"><div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-700 dark:text-blue-300">Your public side, built in</p><h2 className="mt-4 max-w-xl text-4xl font-black leading-[1.02] tracking-[-.045em] text-slate-900 dark:text-white sm:text-6xl">Do great work.<br />Make it easy to hire you.</h2><p className="mt-6 max-w-lg text-lg leading-8 text-slate-600 dark:text-slate-300">Create one polished portfolio from the work already inside Rive. Choose a template, add case studies and services, upload assets directly, and publish one beautiful URL with detailed analytics.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{[[Globe2, "Shareable public URL"], [FileUp, "Direct image uploads"], [Sparkles, "Editable templates"], [BarChart3, "Portfolio analytics"]].map(([Icon, label]) => <div key={label as string} className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white"><Icon size={18} className="text-blue-600 dark:text-blue-300" />{label as string}</div>)}</div><button onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))} className="group mt-9 inline-flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300">Build your portfolio <ArrowRight size={17} className="transition group-hover:translate-x-1" /></button></div><div className="rounded-[28px] bg-[#101d35] p-3 shadow-[0_30px_80px_rgba(15,23,42,.22)]"><div className="overflow-hidden rounded-[20px] bg-[#f8fafc]"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><span className="text-xs font-black text-slate-900">yourname.rive.work</span><span className="rounded-full bg-slate-900 px-3 py-1 text-[9px] font-bold text-white">Work with me</span></div><div className="p-6 sm:p-9"><p className="text-[10px] font-black uppercase tracking-[.16em] text-blue-600">Product designer and developer</p><h3 className="mt-3 max-w-sm text-3xl font-black leading-[1.02] tracking-[-.05em] text-slate-900">A portfolio that tells the story behind the work.</h3><div className="mt-8 grid grid-cols-2 gap-3"><div className="h-32 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-900" /><div className="h-32 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-800" /><div className="col-span-2 rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Selected work</p><div className="mt-3 flex items-center justify-between"><p className="font-black text-slate-900">Rive workspace</p><span className="text-xs font-bold text-blue-600">Case study</span></div></div></div></div></div></div></div></section>;
}
