import type { ReactNode } from "react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SmoothAnchors } from "@/components/marketing/SmoothAnchors";
import { PRODUCTION_ORIGIN } from "@/lib/siteMetadata";

type JsonLdNode =
  | { "@type": "Organization"; "@id": string; name: string; url: string; logo: string }
  | { "@type": "WebSite"; "@id": string; name: string; url: string; publisher: { "@id": string } };

const structuredData: { "@context": string; "@graph": JsonLdNode[] } = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${PRODUCTION_ORIGIN}/#organization`,
      name: "Rive",
      url: PRODUCTION_ORIGIN,
      logo: `${PRODUCTION_ORIGIN}/brand/rive-wordmark.svg`,
    },
    {
      "@type": "WebSite",
      "@id": `${PRODUCTION_ORIGIN}/#website`,
      name: "Rive",
      url: PRODUCTION_ORIGIN,
      publisher: { "@id": `${PRODUCTION_ORIGIN}/#organization` },
    },
  ],
};

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const jsonLd = <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />;

  // Must stay an inline `process.env` comparison: see `env` in next.config.ts.
  if (process.env.MARKETING_SITE_V2 === "1") {
    const { SiteShell } = await import("@/components/site/shell/SiteShell");
    return <SiteShell jsonLd={jsonLd}>{children}</SiteShell>;
  }

  return (
    <div data-surface="marketing" className="marketing-root">
      {jsonLd}
      <a href="#main-content" className="marketing-focus inst-skip-link">Skip to content</a>
      <SiteHeader />
      <SmoothAnchors />
      <main id="main-content" className="relative min-h-screen min-w-0">{children}</main>
      <SiteFooter />
    </div>
  );
}
