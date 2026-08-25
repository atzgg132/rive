"use client";

import { useState, type FormEvent } from "react";
import { Check, Loader2, Send } from "lucide-react";

type ContactFormCopy = {
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  readonly subjectLabel: string;
  readonly subjects: readonly string[];
  readonly messageLabel: string;
  readonly messagePlaceholder: string;
  readonly submitLabel: string;
  readonly submittingLabel: string;
  readonly successTitle: string;
  readonly successBody: string;
  readonly fallbackError: string;
};

const fieldClassName = "marketing-focus min-h-12 w-full rounded-xl border border-[var(--stroke-hairline)] bg-[var(--surface-glass)] px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground hover:border-primary/25 focus:border-primary/50 focus:bg-[var(--surface-glass)]";

export function ContactForm({ copy }: { copy: ContactFormCopy }) {
  const [form, setForm] = useState({ name: "", email: "", subject: copy.subjects[0], message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || copy.fallbackError);
      setStatus("done");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : copy.fallbackError);
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="grid min-h-[31rem] place-items-center rounded-[1.6rem] border border-success/20 bg-success/10 p-8 text-center">
        <div>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-success/20 bg-success/10 text-success"><Check className="h-6 w-6" /></span>
          <h2 className="mt-6 text-2xl font-black text-foreground">{copy.successTitle}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{copy.successBody}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5" noValidate={false}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {copy.nameLabel}
          <input required name="name" autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={fieldClassName} placeholder={copy.namePlaceholder} />
        </label>
        <label className="grid gap-2 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {copy.emailLabel}
          <input required name="email" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={fieldClassName} placeholder={copy.emailPlaceholder} />
        </label>
      </div>
        <label className="grid gap-2 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {copy.subjectLabel}
        <select name="subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className={fieldClassName}>
          {copy.subjects.map((subject) => <option key={subject} value={subject} className="bg-[var(--surface-raised)]">{subject}</option>)}
        </select>
      </label>
        <label className="grid gap-2 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {copy.messageLabel}
        <textarea required minLength={10} name="message" rows={7} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className={`${fieldClassName} resize-y py-3`} placeholder={copy.messagePlaceholder} />
      </label>
      {status === "error" ? <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      <button type="submit" disabled={status === "loading"} className="marketing-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 text-sm font-black text-white shadow-[0_14px_38px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60">
        {status === "loading" ? <><Loader2 className="h-4 w-4 animate-spin" />{copy.submittingLabel}</> : <><Send className="h-4 w-4" />{copy.submitLabel}</>}
      </button>
    </form>
  );
}
