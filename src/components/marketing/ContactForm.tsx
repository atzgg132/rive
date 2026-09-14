"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import HoneypotField, { usePublicFormOpenedAt } from "@/components/HoneypotField";

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

const fieldClassName = "marketing-focus min-h-14 w-full border border-[var(--inst-hairline)] bg-[var(--inst-paper)] px-4 text-base text-[var(--inst-ink)] outline-none transition placeholder:text-[var(--inst-ink-faint)] hover:border-[var(--inst-ink)] focus:border-[var(--inst-ink)]";

export function ContactForm({ copy }: { copy: ContactFormCopy }) {
  const { startedAtRef, websiteRef } = usePublicFormOpenedAt();
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
        body: JSON.stringify({
          ...form,
          website: websiteRef.current?.value ?? "",
          startedAt: startedAtRef.current,
        }),
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
      <div className="grid min-h-[31rem] place-items-center border border-[var(--inst-ink)] bg-[var(--inst-paper-2)] p-8 text-center">
        <div>
          <span className="inst-mono" style={{ color: "var(--inst-ink-soft)" }}><span aria-hidden="true" className="inst-mark inst-mark--circle inst-mark--red" style={{ marginRight: "0.6em" }} />Filed</span>
          <h2 className="mt-4 text-2xl font-bold text-[var(--inst-ink)]">{copy.successTitle}</h2>
          <p className="mt-3 text-sm text-[var(--inst-ink-soft)]">{copy.successBody}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5" noValidate={false}>
      <HoneypotField inputRef={websiteRef} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-[var(--inst-ink)]">
          {copy.nameLabel}
          <input required name="name" autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={fieldClassName} placeholder={copy.namePlaceholder} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-[var(--inst-ink)]">
          {copy.emailLabel}
          <input required name="email" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={fieldClassName} placeholder={copy.emailPlaceholder} />
        </label>
      </div>
        <label className="grid gap-2 text-sm font-bold text-[var(--inst-ink)]">
        {copy.subjectLabel}
        <select name="subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className={fieldClassName}>
          {copy.subjects.map((subject) => <option key={subject} value={subject} className="bg-[var(--inst-paper)]">{subject}</option>)}
        </select>
      </label>
        <label className="grid gap-2 text-sm font-bold text-[var(--inst-ink)]">
        {copy.messageLabel}
        <textarea required minLength={10} name="message" rows={7} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className={`${fieldClassName} resize-y py-3`} placeholder={copy.messagePlaceholder} />
      </label>
      {status === "error" ? <p role="alert" className="border border-[var(--inst-red)] p-3 text-sm text-[var(--inst-red-ink)]">{error}</p> : null}
      <button type="submit" disabled={status === "loading"} className="marketing-focus inst-btn disabled:translate-y-0 disabled:opacity-60">
        {status === "loading" ? <><Loader2 className="h-4 w-4 animate-spin" />{copy.submittingLabel}</> : <>{copy.submitLabel}<Send className="h-4 w-4" /></>}
      </button>
    </form>
  );
}
