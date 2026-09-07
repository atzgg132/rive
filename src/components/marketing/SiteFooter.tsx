import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { footerCopy, footerNav } from "@/content/marketing/nav";
import { RiveLogo } from "@/components/RiveLogo";

export function SiteFooter() {
  return (
    <footer className="edition-footer">
      <div className="edition-container">
        <div className="edition-footer__lead">
          <Link href="/" className="marketing-focus inline-flex" aria-label="Rive home"><RiveLogo height={42} /></Link>
          <p>{footerCopy.description}</p>
          <span>{footerCopy.status}</span>
        </div>
        <div className="edition-footer__nav">
          {footerNav.map((group) => (
            <div key={group.label}>
              <h2>{group.label}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="marketing-focus">
                      {item.label}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="edition-footer__base">
          <p>© {new Date().getFullYear()} {footerCopy.copyright}</p>
          <p>Built for the people running the work.</p>
        </div>
      </div>
    </footer>
  );
}
