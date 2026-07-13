"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Gig Board", href: "#gig-board" },
  { label: "Pricing", href: "#pricing" },
  { label: "Remit", href: "#remit" },
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
          ? "bg-[#F5F8FC]/90 backdrop-blur-2xl border-b border-black/[0.06] py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center group">
          <Image
            src="/brand-assets/logo.png"
            alt="rive."
            width={90}
            height={40}
            className="opacity-90 group-hover:opacity-100 transition-opacity duration-200"
            priority
            style={{ objectFit: "contain" }}
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[13px] text-slate-600 hover:text-slate-900 transition-colors duration-200 font-medium tracking-wide"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "login" }))}
            className="text-[13px] text-slate-600 hover:text-slate-900 transition-colors duration-200 font-medium px-4 py-2 rounded-lg hover:bg-black/5"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Log In
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
            className="text-[13px] font-semibold px-5 py-2.5 rounded-xl text-white transition-all duration-200 hover:-translate-y-px"
            style={{
              fontFamily: "var(--font-display)",
              background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
              boxShadow: "0 4px 20px rgba(29,78,216,0.18)",
            }}
          >
            Get Started Free
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-slate-800 p-2 rounded-lg hover:bg-black/5 transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <div className="w-5 h-4 flex flex-col justify-between">
            <span className={`block h-px bg-slate-800 transition-all duration-300 origin-center ${menuOpen ? "rotate-45 translate-y-[7.5px]" : ""}`} />
            <span className={`block h-px bg-slate-800 transition-all duration-300 ${menuOpen ? "opacity-0 scale-x-0" : ""}`} />
            <span className={`block h-px bg-slate-800 transition-all duration-300 origin-center ${menuOpen ? "-rotate-45 -translate-y-[7.5px]" : ""}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#F5F8FC]/95 backdrop-blur-2xl border-t border-black/[0.06] px-8 py-6 flex flex-col gap-5">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-slate-600 hover:text-slate-955 transition-colors font-medium text-sm"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={() => {
              setMenuOpen(false);
              window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }));
            }}
            className="w-full text-sm font-semibold px-5 py-3 rounded-xl text-white mt-1"
            style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)" }}
          >
            Get Started Free
          </button>
        </div>
      )}
    </nav>
  );
}
