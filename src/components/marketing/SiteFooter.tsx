import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { footerCopy, footerNav } from "@/content/marketing/nav";
import { RiveLogo } from "@/components/RiveLogo";
import { HairlineDivider } from "@/components/marketing/primitives";

export function SiteFooter() {
  return (
    <footer className="marketing-deferred-section relative overflow-x-clip border-t border-[var(--stroke-hairline)] bg-[var(--surface-void)] py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_2fr] lg:gap-20">
          <div>
            <Link href="/" prefetch={false} className="marketing-focus inline-flex rounded-lg" aria-label="Rive home"><RiveLogo height={38} animated /></Link>
            <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">{footerCopy.description}</p>
            <p className="mt-6 inline-flex rounded-full border border-success/20 bg-success/10 px-3 py-1.5 font-mono text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-success">{footerCopy.status}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {footerNav.map((group) => (
              <div key={group.label}>
                <h2 className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group.label}</h2>
                <ul className="mt-4 grid gap-3">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} prefetch={false} className="marketing-focus inline-flex min-h-11 items-center gap-1 rounded text-sm font-semibold text-muted-foreground transition hover:text-primary">{item.label}{item.href.startsWith("mailto:") ? <ArrowUpRight className="h-3 w-3" /> : null}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <HairlineDivider className="my-10" />
        <div className="flex flex-col gap-3 font-mono text-[0.62rem] uppercase tracking-[0.13em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {footerCopy.copyright}</p>
          <p>Built for people whose name is on the work.</p>
        </div>
      </div>
    </footer>
  );
}
