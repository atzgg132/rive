"use client";

import { Button, Input } from "@/components/ui";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import RiveLogo from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import HoneypotField from "@/components/HoneypotField";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const startedAtRef = useRef(Date.now());
  const websiteRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          website: websiteRef.current?.value ?? "",
          startedAt: startedAtRef.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.message || "Please check the email address and try again.");
      else setMessage(data.message);
    } catch {
      setError("We couldn’t reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 dark:bg-background">
      <div className="absolute right-6 top-6"><ThemeToggle /></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2eaf4_1px,transparent_1px),linear-gradient(to_bottom,#e2eaf4_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-50 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)]" />
      <section className="z-10 w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center"><RiveLogo className="h-8 w-auto text-slate-900 dark:text-white" /></Link>
        <div className="glass rounded-2xl border border-border bg-white/85 p-8 shadow-[0_8px_30px_rgb(12,30,54,0.04)] dark:border-slate-800 dark:bg-slate-900/85">
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="mt-2 text-sm">Enter the email on your account. We’ll send a secure, one-time link that expires in 60 minutes.</p>
          {message ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="mb-2 h-5 w-5" />
              <p className="text-emerald-800 dark:text-emerald-300">{message}</p>
              <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">Check spam if it doesn’t arrive within a few minutes.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">{error}</div>}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Email address</span>
                <span className="relative block">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="w-full rounded-xl border border-border bg-white/50 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:focus:ring-blue-900" />
                </span>
              </label>
              <HoneypotField inputRef={websiteRef} />
              <Button type="submit" disabled={loading} className="flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(29,78,216,0.18)] disabled:opacity-70">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send secure reset link"}
              </Button>
            </form>
          )}
          <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400"><ArrowLeft className="h-3.5 w-3.5" />Back to login</Link>
        </div>
      </section>
    </main>
  );
}
