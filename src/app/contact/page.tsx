"use client";

import { Button, Input, Textarea, Select } from "@/components/ui";
import PageShell from "@/components/PageShell";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "General Inquiry", message: "" });
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Your message could not be sent.");
      setState("done");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Your message could not be sent.");
      setState("error");
    }
  };

  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-blue-100/20 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-8">

          {/* Header */}
          <div className="mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/40 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-5" style={font}>
              Get in touch
            </div>
            <h1 className="text-6xl md:text-7xl font-bold text-foreground dark:text-white tracking-tight mb-4" style={fontD}>
              Let&apos;s talk.
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md leading-relaxed" style={font}>
              Questions, support, press, or partnerships. One inbox.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-10">
            {/* Form */}
            <div className="md:col-span-3">
              {state === "done" ? (
                <div className="flex flex-col items-center justify-center py-24 gap-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                    <span className="text-3xl">✓</span>
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1" style={fontD}>Message received.</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm" style={font}>We&apos;ll get back to you within 24 hours.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-8 flex flex-col gap-5 transition-colors">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-600 dark:text-slate-300" style={font}>Name</label>
                      <Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                        className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all placeholder-slate-400" style={font} placeholder="Your name" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-600 dark:text-slate-300" style={font}>Email</label>
                      <Input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                        className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all placeholder-slate-400" style={font} placeholder="you@email.com" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-300" style={font}>Subject</label>
                    <Select value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}
                      className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-400 transition-all" style={font}>
                      {["General Inquiry","Partnership","Press","Feedback","Bug Report"].map(s => <option key={s}>{s}</option>)}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-300" style={font}>Message</label>
                    <Textarea required rows={5} value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                      className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all resize-none placeholder-slate-400" style={font} placeholder="Tell us what's on your mind..." />
                  </div>
                  <Button type="submit" disabled={state === "loading"}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all duration-200 shadow-lg shadow-blue-600/15 disabled:opacity-75" style={fontD}>
                    {state === "loading" ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : "Send message →"}
                  </Button>
                  {state === "error" && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                </form>
              )}
            </div>

            <aside className="md:col-span-2">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm dark:shadow-none">
                <p className="text-sm font-bold text-slate-800 dark:text-white" style={fontD}>Email</p>
                <a
                  href="mailto:hello@rive.work"
                  className="mt-2 block font-bold text-lg text-slate-800 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 transition-colors"
                  style={fontD}
                >
                  hello@rive.work
                </a>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400" style={font}>
                  For questions, support, press, or anything else.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
