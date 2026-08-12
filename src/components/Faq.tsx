"use client";

import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "What is rive.?",
    answer: "Rive is an all-in-one operating workspace for digital service providers—from individual specialists to studios, agencies, consultancies, and small service teams. It connects client management, project delivery, Agreements, finances, planning, and a public portfolio.",
  },
  {
    question: "Can I use rive. today?",
    answer: "rive. is in early access. We admit users in manageable batches so we can maintain a reliable product and learn directly from the people using it.",
  },
  {
    question: "What happens after a client accepts an Agreement?",
    answer: "Rive keeps the accepted version and acceptance evidence connected to the client and project, then makes agreed payment terms available as deliberate invoice triggers. It does not claim regulated or legally binding signatures.",
  },
  {
    question: "How much does rive. cost?",
    answer: "The current early-access workspace is free. We will share clear pricing before introducing paid plans, and early users will receive advance notice.",
  },
  {
    question: "What makes the workspace connected?",
    answer: "The same records power every view. A client links to projects, Agreements, and invoices; project milestones and invoice due dates appear on your calendar; revenue and expenses update your business overview automatically.",
  },
  {
    question: "Can I bring my existing data into rive.?",
    answer: "Yes. Rive supports CSV and XLSX imports for clients, projects, invoices, and expenses, so you can start with the business data you already have.",
  },
];

const publicFaqs = faqs
  .filter((faq) => !faq.question.includes("accepts an Agreement"))
  .map((faq) => ({ ...faq, answer: faq.answer.replaceAll("Agreements, ", "") }));

export default function Faq({ agreementsEnabled = true }: { agreementsEnabled?: boolean }) {
  const visibleFaqs = agreementsEnabled ? faqs : publicFaqs;
  return (
    <section id="faq" className="relative bg-background dark:bg-background py-28 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-100/10 blur-[110px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5">
            <HelpCircle className="w-3.5 h-3.5" />
            <span style={{ fontFamily: "var(--font-body)" }}>Frequently asked questions</span>
          </div>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-slate-900 dark:text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Clear answers.{" "}
            <span className="text-blue-700 dark:text-blue-400">No guesswork.</span>
          </h2>
        </div>

        {/* FAQ grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {visibleFaqs.map((faq) => (
            <div
              key={faq.question}
              className="flex flex-col p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none transition-colors"
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
