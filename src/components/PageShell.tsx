"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import RiveLogo from "@/components/RiveLogo";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Gig Board", href: "/#gig-board" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Remit", href: "/#remit" },
];

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F8FC] dark:bg-[#0B1120]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#F5F8FC] dark:bg-[#0B1120]/90 backdrop-blur-2xl border-b border-black/[0.06] py-3">
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center group">
            <RiveLogo className="h-8 w-auto" />
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-[13px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors duration-200"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-bold transition-all duration-200 hover:-translate-y-px"
            style={{
              fontFamily: "var(--font-display)",
              background: "linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%)",
              boxShadow: "0 4px 20px rgba(29,78,216,0.18)",
            }}
          >
            join waitlist
          </button>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-[#F5F8FC] dark:bg-[#0B1120] py-10">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center">
            <RiveLogo className="h-6 w-auto" />
          </Link>
          <p className="text-slate-400 dark:text-slate-500 text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>
            © 2026 rive. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium" style={{ fontFamily: "var(--font-body)" }}>
              All systems operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
