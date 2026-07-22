"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, User, Mail, Lock, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import RiveLogo from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function RegisterPage() {
  const router = useRouter();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<"register" | "status">("register");

  // Register state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Status state
  const [statusEmail, setStatusEmail] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<{status: string, message: string} | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name || loading) return;
    
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();
      if (data.success) {
        // Log them in immediately after register
        await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        router.push("/dashboard");
      } else {
        setError(data.message || "Failed to create account. Please try again.");
      }
    } catch {
      setError("Connection error. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusEmail || statusLoading) return;
    
    setStatusLoading(true);
    setStatusResult(null);

    try {
      const res = await fetch(`/api/auth/waitlist-status?email=${encodeURIComponent(statusEmail)}`);
      const data = await res.json();
      if (data.success) {
        setStatusResult({ status: data.status, message: data.message });
      } else {
        setStatusResult({ status: "error", message: data.message || "An error occurred." });
      }
    } catch {
      setStatusResult({ status: "error", message: "Connection error." });
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC] dark:bg-[#0B1120] px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors">
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Decorative background grid and blurs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2eaf4_1px,transparent_1px),linear-gradient(to_bottom,#e2eaf4_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "-2s" }}></div>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <RiveLogo className="h-8 w-auto text-slate-900 dark:text-white" />
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-[#0C1E36] dark:text-slate-100">join the freelance os</h2>
          <p className="mt-1.5 text-sm text-[#4A5E78] dark:text-slate-400">set up your workspace and take control of your business.</p>
        </div>

        <div className="glass p-8 bg-white/80 dark:bg-slate-900/80 border border-[#E2EAF4] dark:border-slate-800 shadow-[0_8px_30px_rgb(12,30,54,0.04)] rounded-2xl">
          
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
            <button
              onClick={() => setActiveTab("register")}
              className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${
                activeTab === "register" 
                ? "bg-white dark:bg-slate-700 text-[#0C1E36] dark:text-white shadow-sm" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Create Account
            </button>
            <button
              onClick={() => setActiveTab("status")}
              className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${
                activeTab === "status" 
                ? "bg-white dark:bg-slate-700 text-[#0C1E36] dark:text-white shadow-sm" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Check Waitlist Status
            </button>
          </div>

          {activeTab === "register" ? (
            <form onSubmit={handleRegister} className="flex flex-col gap-4 animate-fade-in">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-semibold">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#0C1E36] dark:text-slate-300 tracking-wide">full name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78] dark:text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2EAF4] dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all duration-200 disabled:opacity-60 bg-white/50 dark:bg-slate-800/50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#0C1E36] dark:text-slate-300 tracking-wide">email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78] dark:text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2EAF4] dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all duration-200 disabled:opacity-60 bg-white/50 dark:bg-slate-800/50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#0C1E36] dark:text-slate-300 tracking-wide">password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78] dark:text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2EAF4] dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all duration-200 disabled:opacity-60 bg-white/50 dark:bg-slate-800/50"
                  />
                </div>
                <p className="text-[10px] text-[#4A5E78] dark:text-slate-500 mt-1">must be at least 8 characters long.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full py-3 px-4 flex justify-center items-center rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-px shadow-[0_4px_14px_rgba(29,78,216,0.25)]"
                style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)" }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
              </button>

              <div className="mt-4 text-center">
                <p className="text-xs text-[#4A5E78] dark:text-slate-400 font-medium">
                  already have an account?{" "}
                  <Link href="/login" className="text-[#1D4ED8] dark:text-blue-400 hover:underline font-bold">
                    log in
                  </Link>
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCheckStatus} className="flex flex-col gap-4 animate-fade-in">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                Enter your email to check if you have been approved from the waitlist.
              </p>
              
              <div className="flex flex-col gap-1.5">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78] dark:text-slate-400" />
                  <input
                    type="email"
                    value={statusEmail}
                    onChange={(e) => setStatusEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    disabled={statusLoading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2EAF4] dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all duration-200 disabled:opacity-60 bg-white/50 dark:bg-slate-800/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={statusLoading}
                className="mt-2 w-full py-3 px-4 flex justify-center items-center rounded-xl text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {statusLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Check Status"}
              </button>

              {statusResult && (
                <div className={`mt-4 p-4 rounded-xl border flex gap-3 ${
                  statusResult.status === "approved" 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300"
                    : statusResult.status === "pending"
                    ? "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                    : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
                }`}>
                  {statusResult.status === "approved" ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold capitalize">{statusResult.status.replace("_", " ")}</h4>
                    <p className="text-xs mt-1 opacity-90">{statusResult.message}</p>
                    {statusResult.status === "approved" && (
                      <button 
                        onClick={() => {
                          setEmail(statusEmail);
                          setActiveTab("register");
                        }}
                        className="mt-3 text-xs font-bold underline"
                      >
                        Create your account now &rarr;
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form>
          )}

        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-[#4A5E78] dark:text-slate-400 text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>secure cookie session • 256-bit encryption</span>
        </div>
      </div>
    </div>
  );
}
