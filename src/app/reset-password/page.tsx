"use client";

import { Button } from "@/components/ui";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import RiveLogo from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import PasswordInput from "@/components/PasswordInput";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 8) return setError("Use at least 8 characters.");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.message || "This reset link could not be used.");
      else setSuccess(true);
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
          {success ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <h1 className="mt-4 text-2xl font-bold">Password updated</h1>
              <p className="mt-2 text-sm">Your new password is active. You can sign in now.</p>
              <Link href="/login" className="mt-6 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white">Continue to login</Link>
            </div>
          ) : (
            <>
              <LockKeyhole className="mb-4 h-7 w-7 text-blue-600" />
              <h1 className="text-2xl font-bold">Choose a new password</h1>
              <p className="mt-2 text-sm">Make it memorable, unique, and at least 8 characters long.</p>
              {!token ? (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  This page needs a valid reset link. <Link href="/forgot-password" className="font-bold underline">Request a new one.</Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">{error}</div>}
                  <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">New password</span><PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" className="w-full rounded-xl border border-border bg-white/50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:focus:ring-blue-900" /></label>
                  <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Confirm password</span><PasswordInput value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" className="w-full rounded-xl border border-border bg-white/50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:focus:ring-blue-900" /></label>
                  <Button disabled={loading} className="flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-70">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update password"}</Button>
                </form>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
