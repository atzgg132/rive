"use client";
import PageShell from "@/components/PageShell";
import { useState } from "react";
import { submitToWaitlist } from "@/utils/api";
import { Loader2 } from "lucide-react";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const contactMethods = [
  { label: "general",  email: "hello@rive.app",   desc: "questions, feedback, anything" },
  { label: "press",    email: "press@rive.app",    desc: "media kits, interviews, coverage" },
  { label: "support",  email: "support@rive.app",  desc: "technical issues & alpha bugs" },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "General Inquiry", message: "" });
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    // small simulated delay for polish
    await new Promise(r => setTimeout(r, 900));
    setState("done");
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
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5" style={font}>
              get in touch
            </div>
            <h1 className="text-6xl md:text-7xl font-bold text-[#0C1E36] tracking-tight mb-4" style={fontD}>
              let&apos;s talk.
            </h1>
            <p className="text-slate-500 text-lg max-w-md leading-relaxed" style={font}>
              partnership inquiry, press request, or just want to say hi?
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-10">
            {/* Form */}
            <div className="md:col-span-3">
              {state === "done" ? (
                <div className="flex flex-col items-center justify-center py-24 gap-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                    <span className="text-3xl">✓</span>
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-800 mb-1" style={fontD}>message received.</h3>
                    <p className="text-slate-500 text-sm" style={font}>we&apos;ll get back to you within 24 hours.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 flex flex-col gap-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={font}>name</label>
                      <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                        className="px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" style={font} placeholder="your name" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={font}>email</label>
                      <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                        className="px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" style={font} placeholder="you@email.com" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={font}>subject</label>
                    <select value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}
                      className="px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-blue-400 transition-all bg-white" style={font}>
                      {["General Inquiry","Partnership","Press","Feedback","Bug Report"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={font}>message</label>
                    <textarea required rows={5} value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                      className="px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none" style={font} placeholder="tell us what's on your mind..." />
                  </div>
                  <button type="submit" disabled={state === "loading"}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all duration-200 shadow-lg shadow-blue-600/15 disabled:opacity-75" style={fontD}>
                    {state === "loading" ? <><Loader2 className="w-4 h-4 animate-spin" /> sending...</> : "send message →"}
                  </button>
                </form>
              )}
            </div>

            {/* Contact info */}
            <div className="md:col-span-2 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide" style={fontD}>contact channels</h3>
              {contactMethods.map(m => (
                <div key={m.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1 block" style={font}>{m.label}</span>
                  <a href={`mailto:${m.email}`} className="font-bold text-slate-800 hover:text-blue-600 transition-colors text-sm block mb-1" style={fontD}>{m.email}</a>
                  <p className="text-slate-400 text-xs" style={font}>{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
