"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { accountNav, marketingHeaderLinks, marketingNav } from "@/content/marketing/nav";
import { RiveLogo } from "@/components/RiveLogo";

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <header data-testid="site-header" className="inst-masthead">
      <div className="inst-masthead__inner">
        <Link href="/" className="marketing-focus inline-flex" aria-label="Rive home" onClick={() => setMobileOpen(false)}>
          <RiveLogo height={26} color="#181511" accentColor="#d0341c" />
        </Link>

        <nav aria-label="Primary navigation" className="inst-masthead__nav">
          {marketingHeaderLinks.map((item, index) => (
            <Link key={item.href} href={item.href} className="marketing-focus inst-masthead__link">
              <span className="inst-mono">{String(index + 1).padStart(2, "0")}</span>
              {item.label}
            </Link>
          ))}
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
