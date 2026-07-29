"use client";

import { FormEvent, useState } from "react";
import { ArrowUpRight, Check, Loader2, Mail } from "lucide-react";

type Props = {
  portfolioSlug?: string;
  contactEmail: string;
  preview: boolean;
};

const fieldClass =
  "w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/55 transition focus:border-white/60 focus:bg-white/15 focus:ring-2 focus:ring-white/20";

export default function PortfolioInquiryForm({ portfolioSlug, contactEmail, preview }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview || !portfolioSlug) {
      setError("Enquiries become active on your published portfolio.");
      return;
    }

    setSending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/public/portfolio/${encodeURIComponent(portfolioSlug)}/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          projectType: form.get("projectType"),
          message: form.get("message"),
          website: form.get("website"),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Your enquiry could not be sent.");
      setSent(true);
      event.currentTarget.reset();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Your enquiry could not be sent.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-white/25 bg-white/10 p-6 backdrop-blur-sm sm:p-8">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--portfolio-accent)]">
          <Check className="h-5 w-5" />
        </span>
        <h3 className="mt-5 text-xl font-black text-white">Your enquiry is on its way.</h3>
        <p className="mt-2 text-sm leading-6 text-white/75">You can expect a reply directly at the email address you provided.</p>
        <button type="button" onClick={() => setSent(false)} className="mt-5 text-xs font-extrabold text-white underline underline-offset-4">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/25 bg-white/10 p-5 backdrop-blur-sm sm:p-7">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/70">Your name</span>
          <input name="name" required minLength={2} maxLength={120} autoComplete="name" className={fieldClass} placeholder="Jane Smith" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/70">Work email</span>
          <input name="email" required type="email" maxLength={320} autoComplete="email" className={fieldClass} placeholder="jane@company.com" />
        </label>
        <label className="grid gap-1.5 sm:col-span-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/70">What can I help with?</span>
          <input name="projectType" required minLength={2} maxLength={120} className={fieldClass} placeholder="Website redesign, product strategy, brand film…" />
        </label>
        <label className="grid gap-1.5 sm:col-span-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/70">A little about the project</span>
          <textarea name="message" required minLength={10} maxLength={5000} rows={4} className={`${fieldClass} resize-y`} placeholder="Share the goal, rough scope, timeline, or anything useful to know." />
        </label>
        <label className="hidden" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-xs font-semibold text-white">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] leading-4 text-white/60">
          {preview ? "Preview mode — publishing activates this form." : "Your details are sent only to the portfolio owner."}
        </p>
        <button disabled={sending} type="submit" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-[var(--portfolio-accent)] shadow-xl transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {sending ? "Sending…" : "Send enquiry"}
          {!sending && <ArrowUpRight className="h-4 w-4" />}
        </button>
      </div>
      {!preview && contactEmail && (
        <p className="mt-4 border-t border-white/20 pt-4 text-[10px] text-white/65">
          Prefer email? <a className="font-bold text-white underline underline-offset-4" href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      )}
    </form>
  );
}
