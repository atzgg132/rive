"use client";

import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { accountNav, marketingNav } from "@/content/marketing/nav";
import { RiveLogo } from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    const update = () => {
      frame.current = 0;
      setScrolled(window.scrollY > 20);
    };
    const onScroll = () => { if (!frame.current) frame.current = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame.current); };
  }, []);

  useEffect(() => {
    if (!mobileOpen && !openGroup) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setOpenGroup(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, openGroup]);

  return (
    <header
      data-testid="site-header"
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,padding,backdrop-filter] duration-300 ease-rive-out ${scrolled || mobileOpen || openGroup ? "border-white/[0.08] bg-[#05070c]/86 py-2.5 backdrop-blur-2xl" : "border-transparent bg-transparent py-4"}`}
      onMouseLeave={() => setOpenGroup(null)}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
        <Link href="/" prefetch={false} className="marketing-focus relative z-10 inline-flex rounded-lg" aria-label="Rive home">
          <RiveLogo height={30} className="text-white" />
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
          {marketingNav.map((group) => {
            const open = openGroup === group.label;
            return (
              <div key={group.label} className="relative" onMouseEnter={() => setOpenGroup(group.label)}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`nav-${group.label.toLowerCase()}`}
                  onClick={() => setOpenGroup(open ? null : group.label)}
                  onFocus={() => setOpenGroup(group.label)}
                  className="marketing-focus flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.78rem] font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  {group.label}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {open ? (
                  <div id={`nav-${group.label.toLowerCase()}`} className="absolute left-1/2 top-[calc(100%+0.75rem)] w-[22rem] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0a0e16]/95 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} prefetch={false} onClick={() => setOpenGroup(null)} className="marketing-focus block rounded-xl px-4 py-3 transition hover:bg-white/[0.055]">
                        <span className="block text-sm font-bold text-white">{item.label}</span>
                        {item.description ? <span className="mt-1 block text-xs leading-5 text-slate-400">{item.description}</span> : null}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Link href={accountNav.login.href} prefetch={false} className="marketing-focus rounded-lg px-3 py-2 text-[0.78rem] font-semibold text-slate-300 hover:bg-white/[0.05] hover:text-white">{accountNav.login.label}</Link>
          <Link href={accountNav.signup.href} prefetch={false} className="marketing-focus rounded-xl bg-white px-4 py-2.5 text-[0.78rem] font-black text-slate-950 transition hover:bg-blue-50">{accountNav.signup.label}</Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button type="button" onClick={() => setMobileOpen((open) => !open)} className="marketing-focus grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav aria-label="Mobile navigation" className="mx-auto mt-2 max-h-[calc(100dvh-5rem)] max-w-7xl overflow-y-auto border-t border-white/[0.07] px-5 py-4 sm:px-8 md:hidden">
          <div className="grid gap-5">
            {marketingNav.map((group) => (
              <div key={group.label}>
                <p className="px-3 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-blue-300">{group.label}</p>
                <div className="mt-2 grid gap-1">
                  {group.items.map((item) => <Link key={item.href} href={item.href} prefetch={false} onClick={() => setMobileOpen(false)} className="marketing-focus rounded-xl px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.05]">{item.label}</Link>)}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-4">
              <Link href={accountNav.login.href} prefetch={false} onClick={() => setMobileOpen(false)} className="marketing-focus rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-bold text-white">{accountNav.login.label}</Link>
              <Link href={accountNav.signup.href} prefetch={false} onClick={() => setMobileOpen(false)} className="marketing-focus rounded-xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950">{accountNav.signup.label}</Link>
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
