import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { footerCopy, footerNav } from "@/content/marketing/nav";
import { RiveLogo } from "@/components/RiveLogo";
import { InstMark } from "@/components/marketing/primitives";

export function SiteFooter() {
  return (
    <footer className="inst-colophon">
      <div className="inst-container">
        <div className="inst-colophon__top">
          <div className="inst-colophon__lead">
            <Link href="/" className="marketing-focus inline-flex" aria-label="Rive home">
              <RiveLogo height={34} color="#181511" accentColor="#d0341c" />
            </Link>
            <p>{footerCopy.description}</p>
          </div>
          <div>
            <span className="inst-colophon__status inst-mono">
              <InstMark mark="circle" red />{footerCopy.status}
            </span>
          </div>
        </div>

        <nav className="inst-colophon__nav" aria-label="Footer navigation">
          {footerNav.map((group, groupIndex) => (
            <div key={group.label}>
              <span className="inst-mono">{String(groupIndex + 1).padStart(2, "0")} / {group.label}</span>
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="marketing-focus inline-flex items-center gap-1.5">
                      {item.label}<ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="inst-colophon__base">
          <p className="inst-mono">© {new Date().getFullYear()} {footerCopy.copyright}</p>
          <p className="inst-mono">Set in Archivo & Martian Mono</p>
        </div>
      </div>
    </footer>
  );
}
