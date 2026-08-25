"use client";

import { Button, Input } from "@/components/ui";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, User, Mail, Lock, ShieldCheck, CheckCircle2 } from "lucide-react";
import RiveLogo from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import PasswordInput from "@/components/PasswordInput";
import HoneypotField from "@/components/HoneypotField";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [notice, setNotice] = useState("");
  const startedAtRef = useRef(Date.now());
  const websiteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const queryEmail = new URLSearchParams(window.location.search).get("email");
      if (queryEmail) setPendingEmail(queryEmail);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password || !name || loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const inviteToken = new URLSearchParams(window.location.search).get("invite") || undefined;
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          inviteToken,
          website: websiteRef.current?.value ?? "",
          startedAt: startedAtRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.message || "Unable to create your account. Please try again.");
        return;
      }
      setPendingEmail(email.trim().toLowerCase());
      setPassword("");
      setNotice("Your account is ready. Check your inbox for the verification link.");
    } catch {
      setError("Connection error. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!pendingEmail || resending) return;
    setResending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const data = await response.json().catch(() => ({}));
      setNotice(data.message || "If the account needs verification, a fresh link is on its way.");
    } catch {
      setError("We could not resend the link. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 transition-colors sm:px-6 lg:px-8">
      <div className="absolute right-3 top-3 z-50 sm:right-6 sm:top-6"><ThemeToggle /></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2eaf4_1px,transparent_1px),linear-gradient(to_bottom,#e2eaf4_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-50 dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      <div className="absolute left-1/4 top-1/4 h-96 w-96 animate-float rounded-full bg-blue-400/10 blur-3xl dark:bg-blue-600/10" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 animate-float rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-600/10" style={{ animationDelay: "-2s" }} />

      <div className="z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="mb-8 flex items-center gap-2"><RiveLogo className="h-8 w-auto text-slate-900 dark:text-white" /></Link>
          <h1 className="text-center text-2xl font-bold tracking-tight text-foreground dark:text-slate-100">Create your Rive workspace</h1>
          <p className="mt-1.5 text-center text-sm text-muted-foreground dark:text-slate-400">Free access during open beta. Start with the work that feels messiest today.</p>
        </div>

        <div className="glass rounded-2xl border border-border bg-white/80 p-5 shadow-[0_8px_30px_rgb(12,30,54,0.04)] dark:border-slate-800 dark:bg-slate-900/80 sm:p-8">
          {pendingEmail ? (
            <div className="flex flex-col items-center text-center">
              <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"><Mail className="h-7 w-7" /></div>
              <h2 className="text-xl font-bold text-foreground dark:text-white">Check your email</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground dark:text-slate-400">We sent a verification link to <span className="font-semibold text-foreground dark:text-slate-200">{pendingEmail}</span>. Verify it to open your workspace.</p>
              {notice && <div className="mt-5 flex w-full items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 text-left text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}
              {error && <div className="mt-5 w-full rounded-xl border border-red-100 bg-red-50 p-3.5 text-left text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}
              <Button type="button" onClick={resend} disabled={resending} className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                {resending ? <><Loader2 className="h-4 w-4 animate-spin" />Sending fresh link...</> : "Resend verification email"}
              </Button>
              <button type="button" onClick={() => { setPendingEmail(""); setNotice(""); setError(""); }} className="mt-4 text-xs font-bold text-primary hover:underline dark:text-blue-400">Use a different email</button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              {error && <div className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="register-name" className="text-xs font-bold tracking-wide text-foreground dark:text-slate-300">Full name</label>
                <div className="relative"><User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="register-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required disabled={loading} className="w-full rounded-xl border border-border bg-white/50 py-3 pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800/50" /></div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="register-email" className="text-xs font-bold tracking-wide text-foreground dark:text-slate-300">Email address</label>
                <div className="relative"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required disabled={loading} className="w-full rounded-xl border border-border bg-white/50 py-3 pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800/50" /></div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="register-password" className="text-xs font-bold tracking-wide text-foreground dark:text-slate-300">Password</label>
                <div className="relative"><Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><PasswordInput id="register-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required disabled={loading} className="w-full rounded-xl border border-border bg-white/50 py-3 pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800/50" /></div>
                <p className="mt-1 text-[10px] text-muted-foreground">Use at least 8 characters.</p>
              </div>
              <HoneypotField inputRef={websiteRef} />
              <p className="text-[11px] leading-5 text-muted-foreground">By creating an account, you agree to our <Link href="/terms" className="font-semibold text-primary hover:underline">Terms</Link> and <Link href="/privacy" className="font-semibold text-primary hover:underline">Privacy Policy</Link>.</p>
              <Button type="submit" disabled={loading} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(29,78,216,0.25)] hover:bg-blue-700 disabled:opacity-70">{loading ? <><Loader2 className="h-5 w-5 animate-spin" />Creating workspace...</> : "Create Account"}</Button>
              <div className="mt-2 border-t border-border pt-5 text-center dark:border-slate-800"><p className="text-xs font-medium text-muted-foreground">Already have an account? <Link href="/login" className="font-bold text-primary hover:underline dark:text-blue-400">Log in</Link></p></div>
            </form>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-500" /><span>Secure cookie session • email verification required</span></div>
      </div>
    </div>
  );
}
