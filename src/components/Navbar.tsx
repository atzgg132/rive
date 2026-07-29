"use client";

import { Button } from "@/components/ui";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RiveLogo } from "@/components/RiveLogo";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Portfolio", href: "#portfolio" },
  { label: "Opportunities", href: "#gig-board" },
  { label: "Remit", href: "#remit" },
  { label: "Pricing", href: "#pricing" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-background dark:bg-background/90 dark:bg-background/90 backdrop-blur-2xl border-b border-black/[0.06] dark:border-white/[0.06] py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link href="/" className="flex items-center group">
          <RiveLogo height={28} className="text-foreground dark:text-white" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 lg:gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[13px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors duration-200 font-medium tracking-wide"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-[13px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors duration-200 font-medium px-4 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Log In
          </Link>
          <Button
            onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
            className="text-[13px] font-semibold px-5 py-2.5 rounded-xl text-white transition-all duration-200 hover:-translate-y-px"
            style={{
              fontFamily: "var(--font-display)",
              background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
              boxShadow: "0 4px 20px rgba(29,78,216,0.18)",
            }}
          >
            Get Started Free
          </Button>
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Button
            className="text-slate-800 dark:text-slate-200 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className={`block h-px bg-slate-800 dark:bg-slate-200 transition-all duration-300 origin-center ${menuOpen ? "rotate-45 translate-y-[7.5px]" : ""}`} />
              <span className={`block h-px bg-slate-800 dark:bg-slate-200 transition-all duration-300 ${menuOpen ? "opacity-0 scale-x-0" : ""}`} />
              <span className={`block h-px bg-slate-800 dark:bg-slate-200 transition-all duration-300 origin-center ${menuOpen ? "-rotate-45 -translate-y-[7.5px]" : ""}`} />
            </div>
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="flex flex-col gap-2 border-t border-black/[0.06] bg-background/95 px-4 py-4 backdrop-blur-2xl dark:border-white/[0.06] dark:bg-background/95 md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link href="/login" onClick={() => setMenuOpen(false)} className="rounded-xl border border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Log in</Link>
          <Button
            onClick={() => {
              setMenuOpen(false);
              window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }));
            }}
            className="w-full text-sm font-semibold px-5 py-3 rounded-xl text-white mt-1"
            style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)" }}
          >
            Get Started Free
          </Button>
        </div>
      )}
    </nav>
  );
}
