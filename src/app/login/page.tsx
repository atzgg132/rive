"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, ShieldCheck, Mail, Lock } from "lucide-react";
import RiveLogo from "@/components/RiveLogo";

export default function LoginPage() {
  const router = useRouter();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (data.success) {
        router.push("/dashboard");
      } else {
        setError(data.message || "invalid credentials. please try again.");
      }
    } catch (err) {
      setError("connection error. check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC] px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background grid and blurs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2eaf4_1px,transparent_1px),linear-gradient(to_bottom,#e2eaf4_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "-2s" }}></div>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-3">
            <RiveLogo className="h-8 w-auto" />
            <span className="text-2xl font-bold tracking-tight text-[#0C1E36]">rive.</span>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-[#0C1E36]">welcome back to your os</h2>
          <p className="mt-1.5 text-sm text-[#4A5E78]">manage your clients, projects, and money in one place.</p>
        </div>

        <div className="glass p-8 bg-white/80 border border-[#E2EAF4] shadow-[0_8px_30px_rgb(12,30,54,0.04)] rounded-2xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0C1E36] tracking-wide">email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2EAF4] text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200 disabled:opacity-60 bg-white/50"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-[#0C1E36] tracking-wide">password</label>
                <Link href="#" className="text-xs text-[#1D4ED8] hover:underline font-semibold">forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2EAF4] text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200 disabled:opacity-60 bg-white/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-[#1D4ED8] text-white font-semibold text-sm hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(29,78,216,0.15)] disabled:opacity-75"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>signing you in...</span>
                </>
              ) : (
                <>
                  <span>sign in</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#E2EAF4] text-center">
            <p className="text-xs text-[#4A5E78]">
              don&apos;t have an account?{" "}
              <Link href="/register" className="text-[#1D4ED8] hover:underline font-bold">
                create one for free
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-[#4A5E78] text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>secure cookie session • 256-bit encryption</span>
        </div>
      </div>
    </div>
  );
}
