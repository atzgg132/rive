import type { ReactNode } from "react";
import Link from "next/link";
import RiveLogo from "@/components/RiveLogo";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div data-surface="marketing" className="edition-standalone-auth">
      <header><Link href="/" className="marketing-focus" aria-label="Rive home"><RiveLogo height={31} /></Link><Link href="/login" className="marketing-focus">Log in</Link></header>
      <main><section className="edition-standalone-auth__art"><p>Rive account</p><h2 className="edition-display">Your business,<br /><em>back in view.</em></h2><span>Secure account access</span></section><section data-surface="auth-overlay" className="edition-standalone-auth__form">{children}</section></main>
    </div>
  );
}
