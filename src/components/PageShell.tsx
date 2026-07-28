"use client";

import { Button } from "@/components/ui";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import RiveLogo from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import Modal from "@/components/Modal";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Gig Board", href: "/#gig-board" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Remit", href: "/#remit" },
];

export default function PageShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background dark:bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-background dark:bg-background/90 backdrop-blur-2xl border-b border-black/[0.06] py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
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
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <Link href="/login" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Log in</Link>
            <Button onClick={() => setWaitlistOpen(true)} className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-bold text-white shadow-lg shadow-blue-600/15 hover:bg-blue-700">Join waitlist</Button>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label={menuOpen ? "Close navigation" : "Open navigation"} className="grid h-10 w-10 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {menuOpen && <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {navLinks.map((link) => <Link key={link.label} href={link.href} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-900">{link.label}</Link>)}
            <Link href="/login" onClick={() => setMenuOpen(false)} className="mt-2 rounded-xl border border-slate-200 px-3 py-3 text-center text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Log in</Link>
            <Button onClick={() => { setMenuOpen(false); setWaitlistOpen(true); }} className="rounded-xl bg-blue-600 px-3 py-3 text-sm font-bold text-white">Join waitlist</Button>
          </div>
        </div>}
      </nav>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-background dark:bg-background py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center sm:px-6 md:flex-row md:text-left lg:px-8">
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
      <Modal isOpen={waitlistOpen} onClose={() => setWaitlistOpen(false)} type="waitlist" />
    </div>
  );
}
