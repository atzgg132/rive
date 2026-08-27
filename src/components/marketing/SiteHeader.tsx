"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { accountNav, marketingNav } from "@/content/marketing/nav";
import { RiveLogo } from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SmoothAnchor } from "@/components/marketing/SmoothAnchor";

const signupCtaClassName = "marketing-cta-border marketing-focus group relative isolate inline-flex items-center justify-center overflow-hidden rounded-xl border border-primary/25 bg-primary/10 font-black text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.11),0_10px_30px_rgba(37,99,235,0.12)] backdrop-blur-xl transition duration-200 ease-rive-out hover:-translate-y-px hover:border-primary/45 hover:bg-primary/15 hover:text-primary dark:border-blue-300/25 dark:bg-blue-400/[0.09] dark:text-blue-50 dark:hover:border-cyan-300/45 dark:hover:bg-blue-400/[0.15] dark:hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_14px_36px_rgba(37,99,235,0.2)]";

function SignupCtaLabel() {
  return (
    <span className="relative z-10 inline-flex items-center gap-2">
      <span>{accountNav.signup.label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary dark:text-blue-300 dark:group-hover:text-cyan-200" aria-hidden="true" />
    </span>
  );
}

export function SiteHeader() {
  const [themeToggleReady, setThemeToggleReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only ThemeToggle so SSR matches first paint
    setThemeToggleReady(true);
  }, []);

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
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,padding,backdrop-filter] duration-300 ease-rive-out ${scrolled || mobileOpen || openGroup ? "border-[var(--stroke-hairline)] bg-[color-mix(in_srgb,var(--surface-void)_86%,transparent)] py-2.5 backdrop-blur-2xl" : "border-transparent bg-transparent py-4"}`}
      onMouseLeave={() => setOpenGroup(null)}
    >
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 sm:px-8">
        <Link href="/" prefetch={false} className="marketing-focus relative z-10 inline-flex rounded-lg" aria-label="Rive home">
          <RiveLogo height={30} animated />
        </Link>

        <nav aria-label="Primary navigation" className="absolute left-[calc(50%-0.25rem)] hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {marketingNav.map((group) => {
            const open = openGroup === group.label;
            return (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setOpenGroup(group.label)}
                onBlur={(event) => {
                  const next = event.relatedTarget;
                  if (!(next instanceof Node) || !event.currentTarget.contains(next)) setOpenGroup(null);
                }}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-haspopup="true"
                  aria-controls={`nav-${group.label.toLowerCase()}`}
                  onClick={() => setOpenGroup(open ? null : group.label)}
                  onFocus={() => setOpenGroup(group.label)}
                  className="marketing-focus flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.78rem] font-semibold text-muted-foreground transition hover:bg-[var(--surface-glass)] hover:text-foreground"
                >
                  {group.label}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {open ? (
                  <div id={`nav-${group.label.toLowerCase()}`} className="absolute left-1/2 top-[calc(100%+0.75rem)] w-[22rem] -translate-x-1/2 rounded-2xl border border-[var(--stroke-hairline)] bg-[color-mix(in_srgb,var(--surface-raised)_95%,transparent)] p-2 shadow-overlay backdrop-blur-2xl">
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} prefetch={false} onClick={() => setOpenGroup(null)} className="marketing-focus block rounded-xl px-4 py-3 transition hover:bg-[var(--surface-glass)]">
                        <span className="block text-sm font-bold text-foreground">{item.label}</span>
                        {item.description ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span> : null}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <div className="grid min-h-11 min-w-11 place-items-center">{themeToggleReady ? <ThemeToggle /> : null}</div>
          <Link href={accountNav.login.href} prefetch={false} className="marketing-focus rounded-lg px-3 py-2 text-[0.78rem] font-semibold text-muted-foreground hover:bg-[var(--surface-glass)] hover:text-foreground">{accountNav.login.label}</Link>
          <Link href={accountNav.signup.href} prefetch={false} className={`${signupCtaClassName} px-4 py-2.5 text-[0.78rem]`}><SignupCtaLabel /></Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <div className="grid min-h-11 min-w-11 place-items-center">{themeToggleReady ? <ThemeToggle /> : null}</div>
          <button type="button" onClick={() => setMobileOpen((open) => !open)} className="marketing-focus grid min-h-11 min-w-11 place-items-center rounded-xl border border-[var(--stroke-hairline)] bg-[var(--surface-glass)] text-foreground" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav aria-label="Mobile navigation" className="mx-auto mt-2 flex max-h-[calc(100dvh-5rem)] max-w-7xl flex-col overflow-hidden border-t border-[var(--stroke-hairline)] px-4 lg:hidden sm:px-8">
          <div className="grid flex-1 gap-5 overflow-y-auto py-4">
            {marketingNav.map((group) => (
              <div key={group.label}>
                <p className="px-3 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary">{group.label}</p>
                <div className="mt-2 grid gap-1">
                  {group.items.map((item) => {
                    const className = "marketing-focus rounded-xl px-3 py-3 text-sm font-semibold text-foreground hover:bg-[var(--surface-glass)]";
                    return item.href.includes("#") ? (
                      <SmoothAnchor key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={className}>{item.label}</SmoothAnchor>
                    ) : (
                      <Link key={item.href} href={item.href} prefetch={false} onClick={() => setMobileOpen(false)} className={className}>{item.label}</Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="sticky bottom-0 z-10 -mx-4 grid shrink-0 gap-2 border-t border-[var(--stroke-hairline)] bg-[var(--surface-void)] px-4 py-3 sm:-mx-8 sm:grid-cols-2 sm:px-8">
            <Link href={accountNav.login.href} prefetch={false} onClick={() => setMobileOpen(false)} className="marketing-focus inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--stroke-hairline)] px-4 text-center text-sm font-bold text-foreground">{accountNav.login.label}</Link>
            <Link href={accountNav.signup.href} prefetch={false} onClick={() => setMobileOpen(false)} className={`${signupCtaClassName} min-h-11 px-4 py-3 text-center text-sm`}><SignupCtaLabel /></Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
