import type { ReactNode } from "react";
import "@/components/site/site.css";
import "@/components/site/pages/legacy-skin.css";
import { SiteNav } from "@/components/site/shell/SiteNav";
import { SiteFooter } from "@/components/site/shell/SiteFooter";
import { FloatingStartFree } from "@/components/site/shell/FloatingStartFree";
import { SITE_BOOT_SCRIPT } from "@/components/site/motion/boot";

/** The v2 marketing shell. `data-surface="marketing"` stays so pages that
 * have not moved to v2 yet keep their existing styles inside it. */
export function SiteShell({ children, jsonLd }: { children: ReactNode; jsonLd: ReactNode }) {
  return (
    <div data-site="v2" data-surface="marketing" className="s-root">
      <script dangerouslySetInnerHTML={{ __html: SITE_BOOT_SCRIPT }} />
      {jsonLd}
      <a href="#main-content" className="s-skip">Skip to content</a>
      <SiteNav />
      <main id="main-content" className="s-main">{children}</main>
      <SiteFooter />
      <FloatingStartFree />
    </div>
  );
}
