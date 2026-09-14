import type { ReactNode } from "react";
import Link from "next/link";
import { InstMark } from "@/components/marketing/primitives";
import RiveLogo from "@/components/RiveLogo";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div data-surface="marketing" className="inst-standalone-auth">
      <header>
        <Link href="/" className="marketing-focus inline-flex" aria-label="Rive home"><RiveLogo height={28} color="#181511" accentColor="#d0341c" /></Link>
        <Link href="/login" className="marketing-focus">Log in</Link>
      </header>
      <main>
        <section className="inst-standalone-auth__art">
          <p className="inst-mono"><InstMark mark="circle" red />Rive account</p>
          <h2>Your business,<br />back on the record.</h2>
          <p className="inst-mono">Secure account access</p>
        </section>
        <section data-surface="auth-overlay" className="inst-standalone-auth__form">{children}</section>
      </main>
    </div>
  );
}
