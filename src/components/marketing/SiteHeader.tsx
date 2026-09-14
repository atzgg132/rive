"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Menu, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { accountNav, marketingHeaderNav, marketingNav } from "@/content/marketing/nav";
import { RiveLogo } from "@/components/RiveLogo";

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  /* The open menu lives inside the fixed masthead — lock the page behind
     it so the body can't scroll the nav out of reach. */
  useEffect(() => {
    if (!mobileOpen) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = previous; };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileOpen]);

  useEffect(() => {
    if (!openMenu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenMenu(null);
      window.requestAnimationFrame(() =>
        navRef.current?.querySelector<HTMLButtonElement>(`[data-menu-trigger="${openMenu}"]`)?.focus(),
      );
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [openMenu]);

  return (
    <header data-testid="site-header" className="inst-masthead">
      <div className="inst-masthead__inner">
        <Link href="/" className="marketing-focus inline-flex" aria-label="Rive home" onClick={() => setMobileOpen(false)}>
          <RiveLogo height={26} color="#181511" />
        </Link>

        <nav ref={navRef} aria-label="Primary navigation" className="inst-masthead__nav">
          {marketingHeaderNav.map((entry) =>
            "items" in entry ? (
              <div
                key={entry.label}
                className="inst-masthead__item"
                data-open={openMenu === entry.label || undefined}
                onMouseEnter={() => setOpenMenu(entry.label)}
                onMouseLeave={() => setOpenMenu(null)}
                onFocus={() => setOpenMenu(entry.label)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpenMenu(null);
                }}
              >
                <button
                  type="button"
                  className="marketing-focus inst-masthead__link inst-masthead__trigger"
                  aria-expanded={openMenu === entry.label}
                  aria-haspopup="true"
                  data-menu-trigger={entry.label}
                  onClick={() => setOpenMenu((open) => (open === entry.label ? null : entry.label))}
                >
                  {entry.label}
                  <Plus className="inst-masthead__trigger-mark" aria-hidden="true" />
                </button>
                <div className="inst-masthead__menu">
                  {entry.items.map((item) => (
                    <Link key={item.href} href={item.href} className="marketing-focus inst-masthead__menu-link">
                      <span>
                        {item.label}
                        {item.description ? <span className="inst-mono">{item.description}</span> : null}
                      </span>
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link key={entry.href} href={entry.href} className="marketing-focus inst-masthead__link">
                {entry.label}
              </Link>
            ),
          )}
        </nav>

        <div className="inst-masthead__actions">
          <Link href={accountNav.login.href} className="marketing-focus inst-masthead__login">{accountNav.login.label}</Link>
          <Link href={accountNav.signup.href} className="marketing-focus inst-btn inst-masthead__cta">
            {accountNav.signup.label}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            className="marketing-focus inst-masthead__menu-btn"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-marketing-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav id="mobile-marketing-navigation" aria-label="Mobile navigation" className="inst-mobile-nav">
          <div className="inst-container">
            {marketingNav.map((group) => (
              <div key={group.label} className="inst-mobile-nav__group">
                <span className="inst-mono">{group.label}</span>
                <div>
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href} className="marketing-focus inst-mobile-link" onClick={() => setMobileOpen(false)}>
                      <span>{item.label}</span><ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="inst-mobile-nav__auth">
              <Link href={accountNav.login.href} className="marketing-focus inst-btn inst-btn--ghost" onClick={() => setMobileOpen(false)}>Log in</Link>
              <Link href={accountNav.signup.href} className="marketing-focus inst-btn" onClick={() => setMobileOpen(false)}>Start free <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
