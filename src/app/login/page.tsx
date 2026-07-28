"use client";

import { Button, Input } from "@/components/ui";

import React, { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowRight, ShieldCheck, Mail, Lock } from "lucide-react";
import RiveLogo from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import PasswordInput from "@/components/PasswordInput";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || loading) return;
    
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (data.success) {
        window.location.replace(data.destination || "/dashboard");
        return;
      } else {
        setError(data.message || "Invalid credentials. Please try again.");
      }
    } catch {
      setError("Connection error. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background dark:bg-background px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors">
      <div className="absolute right-3 top-3 z-50 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      {/* Decorative background grid and blurs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2eaf4_1px,transparent_1px),linear-gradient(to_bottom,#e2eaf4_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "-2s" }}></div>

      <div className="z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center sm:mb-8">
          <Link href="/" className="mb-6 flex items-center gap-2 sm:mb-8">
            <RiveLogo className="h-8 w-auto text-slate-900 dark:text-white" />
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-foreground dark:text-slate-100">Welcome back to your OS</h2>
          <p className="mt-1.5 text-sm text-muted-foreground dark:text-slate-400">Manage your clients, projects, and money in one place.</p>
        </div>

        <div className="glass rounded-2xl border border-border bg-white/80 p-5 shadow-[0_8px_30px_rgb(12,30,54,0.04)] dark:border-slate-800 dark:bg-slate-900/80 sm:p-8">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-foreground dark:text-slate-300 tracking-wide">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all duration-200 disabled:opacity-60 bg-white/50 dark:bg-slate-800/50"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-foreground dark:text-slate-300 tracking-wide">Password</label>
                <Link href="/forgot-password" className="text-xs text-primary dark:text-blue-400 hover:underline font-semibold">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-400" />
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all duration-200 disabled:opacity-60 bg-white/50 dark:bg-slate-800/50"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(29,78,216,0.15)] disabled:opacity-75"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing you in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border dark:border-slate-800 text-center">
            <p className="text-xs text-muted-foreground dark:text-slate-400">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-primary dark:text-blue-400 hover:underline font-bold">
                Create one for free
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground dark:text-slate-400 text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Secure cookie session • 256-bit encryption</span>
        </div>
      </div>
    </div>
  );
}
