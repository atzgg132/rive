"use client";

import { Button, Input } from "@/components/ui";

import { useState } from "react";
import { ArrowRight, Loader2, Clock } from "lucide-react";
import { submitToWaitlist } from "@/utils/api";

export default function FinalCTA() {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<"idle" | "loading" | "success" | "already-joined">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || formState === "loading") return;
    setFormState("loading");
    const res = await submitToWaitlist(email, "waitlist");
    if (res.alreadyJoined) {
      setFormState("already-joined");
    } else if (res.success) {
      setFormState("success");
    } else {
      setFormState("idle");
    }
  };

  return (
    <section className="relative bg-background dark:bg-background py-32 overflow-hidden">
      {/* Backgrounds */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 via-transparent to-sky-50/15" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[450px] bg-blue-100/10 rounded-full blur-[130px]" />
      </div>

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.3] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(29,78,216,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(29,78,216,0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative max-w-3xl mx-auto px-8 text-center flex flex-col items-center gap-6">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
          <span style={{ fontFamily: "var(--font-body)" }}>Early access is open</span>
        </div>

        {/* Headline */}
        <h2
          className="max-w-4xl font-black leading-[0.98] tracking-[-0.045em] text-slate-900 dark:text-white"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.75rem, 7vw, 5.75rem)",
          }}
        >
          Stop juggling tools.
          <span className="mt-2 block bg-gradient-to-r from-blue-600 via-sky-500 to-blue-500 bg-clip-text text-transparent">
            Run everything together.
          </span>
        </h2>

        {/* Sub */}
        <p
          className="text-slate-600 dark:text-slate-300 text-lg max-w-xl leading-relaxed font-medium"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Bring client work, delivery, finances, planning, and your public presence into one connected workspace.
        </p>

        {/* Form / States */}
        <div className="w-full max-w-md mt-2 relative">
          {/* Idle + Loading form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 w-full transition-all duration-300"
            style={{
              opacity: formState === "idle" || formState === "loading" ? 1 : 0,
              pointerEvents: formState === "idle" || formState === "loading" ? "auto" : "none",
              transform: formState === "idle" || formState === "loading" ? "translateY(0)" : "translateY(-12px)",
            }}
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={formState === "loading"}
              className="flex-1 min-w-0 px-5 py-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-all duration-200 disabled:opacity-60"
              style={{ fontFamily: "var(--font-body)" }}
            />
            <Button
              type="submit"
              disabled={formState === "loading"}
              className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all duration-200 shadow-lg shadow-blue-600/15 hover:-translate-y-px whitespace-nowrap shrink-0 disabled:opacity-75"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formState === "loading" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Checking...</span></>
              ) : (
                <>Join the waitlist <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
              )}
            </Button>
          </form>

          {/* Success */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-all duration-500"
            style={{
              opacity: formState === "success" ? 1 : 0,
              transform: formState === "success" ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
              pointerEvents: formState === "success" ? "auto" : "none",
            }}
          >
            <div className="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold text-sm shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span style={{ fontFamily: "var(--font-body)" }}>
                You&apos;re on the list. We&apos;ll email you when your access is ready.
              </span>
            </div>
          </div>

          {/* Already joined */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-all duration-500"
            style={{
              opacity: formState === "already-joined" ? 1 : 0,
              transform: formState === "already-joined" ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
              pointerEvents: formState === "already-joined" ? "auto" : "none",
            }}
          >
            <div className="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 font-semibold text-sm shadow-sm">
              <Clock className="w-4 h-4 shrink-0 text-blue-500" />
              <span style={{ fontFamily: "var(--font-body)" }}>
                You&apos;re already on the list. We&apos;ll notify you when your access is ready.
              </span>
            </div>
          </div>
        </div>

        <p
          className="text-slate-400 text-sm font-medium"
          style={{ fontFamily: "var(--font-body)" }}
        >
          free plan available when we launch · no credit card needed · cancel anytime
        </p>
      </div>
    </section>
  );
}
