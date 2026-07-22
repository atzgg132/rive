"use client";

import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "what is rive.?",
    answer: "rive. is a unified workspace designed specifically for freelancers and solo builders to manage their projects, CRM, and revenue in one soothing, simple environment.",
  },
  {
    question: "is this platform live yet?",
    answer: "we are currently in active alpha development. early access will be rolled out in batches to our waitlist members to ensure a smooth, stable experience.",
  },
  {
    question: "how much will it cost?",
    answer: "our core platform features (project and client management) will remain free forever. we will introduce premium tiers later as we build out advanced ai features.",
  },
  {
    question: "how does the ai co-pilot work?",
    answer: "instead of just adding an ai chat box, our co-pilot is built directly into your workflow to automatically index gigs, draft outreach, and prevent double-confirmation billing errors.",
  },
];

export default function Faq() {
  return (
    <section id="faq" className="relative bg-[#F5F8FC] dark:bg-[#0B1120] py-28 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-100/10 blur-[110px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5">
            <HelpCircle className="w-3.5 h-3.5" />
            <span style={{ fontFamily: "var(--font-body)" }}>frequently asked questions</span>
          </div>
          <h2
            className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            clear answers.{" "}
            <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
              no fluff.
            </span>
          </h2>
        </div>

        {/* FAQ grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none transition-colors"
            >
              <h3
                className="text-slate-800 dark:text-white font-bold text-base mb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {faq.question}
              </h3>
              <p
                className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
