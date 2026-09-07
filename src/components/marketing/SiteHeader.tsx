"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { accountNav, marketingHeaderLinks, marketingNav } from "@/content/marketing/nav";
import { RiveLogo } from "@/components/RiveLogo";

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileOpen]);

  return (
    <header data-testid="site-header" className={`edition-header ${scrolled || mobileOpen ? "edition-header--solid" : ""}`}>
      <div className="edition-header__inner">
        <Link href="/" className="marketing-focus edition-logo" aria-label="Rive home" onClick={() => setMobileOpen(false)}>
          <RiveLogo height={31} />
        </Link>

        <nav aria-label="Primary navigation" className="edition-nav">
          {marketingHeaderLinks.map((item) => (
            <Link key={item.href} href={item.href} className="marketing-focus edition-nav__link">{item.label}</Link>
          ))}
        </nav>

        <div className="edition-header__actions">
          <Link href={accountNav.login.href} className="marketing-focus edition-login">{accountNav.login.label}</Link>
          <Link href={accountNav.signup.href} className="marketing-focus edition-header-cta">
            {accountNav.signup.label}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="marketing-focus edition-menu-button"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-marketing-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <nav id="mobile-marketing-navigation" aria-label="Mobile navigation" className="edition-mobile-nav" data-open={mobileOpen ? "true" : "false"}>
        <div className="edition-mobile-nav__inner">
          {marketingNav.map((group) => (
            <div key={group.label}>
              <p className="edition-kicker">{group.label}</p>
              <div className="mt-4 grid">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className="marketing-focus edition-mobile-link" onClick={() => setMobileOpen(false)}>
                    <span>{item.label}</span><ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className="edition-mobile-auth">
            <Link href={accountNav.login.href} className="marketing-focus edition-button edition-button--ghost" onClick={() => setMobileOpen(false)}>Log in</Link>
            <Link href={accountNav.signup.href} className="marketing-focus edition-button edition-button--primary" onClick={() => setMobileOpen(false)}>Start free <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
