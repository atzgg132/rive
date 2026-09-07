import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { MarketingPageContent } from "@/content/marketing/pages";
import { cn } from "@/lib/utils";
import { EditorialLabel, MarketingButton } from "@/components/marketing/primitives";

export function SectionShell({ children, id, className, innerClassName, clipX = true }: { children: ReactNode; id?: string; className?: string; innerClassName?: string; clipX?: boolean }) {
  return <section id={id} className={cn("edition-page-section", className)}><div className={cn("edition-container min-w-0", clipX && "overflow-x-clip", innerClassName)}>{children}</div></section>;
}

export function MarketingPage({ content }: { content: MarketingPageContent }) {
  return (
    <>
      <section className="edition-page-hero">
        <div className="edition-container edition-page-hero__grid">
          <EditorialLabel>{content.eyebrow}</EditorialLabel>
          <h1 className="edition-display">{content.title}</h1>
          <p>{content.intro}</p>
        </div>
      </section>
      <div className="edition-page-sections">
        {content.sections.map((section, sectionIndex) => (
          <section key={section.title} className="edition-page-story" data-tone={sectionIndex % 2 ? "paper" : "bright"}>
            <div className="edition-container edition-page-story__grid">
              <div>{section.eyebrow ? <EditorialLabel>{section.eyebrow}</EditorialLabel> : <span className="edition-story-number">0{sectionIndex + 1}</span>}</div>
              <div>
                <h2 className="edition-display">{section.title}</h2>
                {section.body ? <p className="edition-page-story__body">{section.body}</p> : null}
                {section.cards?.length ? (
                  <div className="edition-story-cards">
                    {section.cards.map((card, index) => (
                      <article key={card.title}>
                        <span>0{index + 1}</span>
                        {card.meta ? <p className="edition-story-meta">{card.meta}</p> : null}
                        <h3>{card.title}</h3>
                        <p>{card.body}</p>
                        {card.href ? <Link href={card.href} className="marketing-focus">Read more <ArrowRight className="h-4 w-4" /></Link> : null}
                      </article>
                    ))}
                  </div>
                ) : null}
                {section.bullets?.length ? <ol className="edition-story-list">{section.bullets.map((bullet, index) => <li key={bullet}><span>{String(index + 1).padStart(2, "0")}</span><p>{bullet}</p></li>)}</ol> : null}
              </div>
            </div>
          </section>
        ))}
      </div>
      {content.cta ? (
        <section className="edition-page-cta"><div className="edition-container"><h2 className="edition-display">{content.cta.headline}</h2><div>{content.cta.note ? <p>{content.cta.note}</p> : null}<MarketingButton href={content.cta.href}>{content.cta.label}</MarketingButton></div></div></section>
      ) : null}
    </>
  );
}

export function IndexShell({ children, eyebrow, title, intro }: { children: ReactNode; eyebrow: string; title: string; intro: string }) {
  return <><section className="edition-page-hero"><div className="edition-container edition-page-hero__grid"><EditorialLabel>{eyebrow}</EditorialLabel><h1 className="edition-display">{title}</h1><p>{intro}</p></div></section><SectionShell clipX={false}>{children}</SectionShell></>;
}

export function ProseShell({ eyebrow, title, children, updated }: { eyebrow: string; title: string; children: ReactNode; updated?: string }) {
  return (
    <section className="edition-legal-page">
      <div className="edition-container">
        <div className="edition-legal-hero"><EditorialLabel>{eyebrow}</EditorialLabel><h1 className="edition-display">{title}</h1><p>{updated}</p></div>
        <div className="edition-legal-document">{children}</div>
      </div>
    </section>
  );
}

export function LegalToc({ items }: { items: readonly { id: string; label: string }[] }) {
  return (
    <aside className="edition-legal-toc">
      <p>On this page</p>
      <nav aria-label="On this page">{items.map((item) => <a key={item.id} href={`#${item.id}`} className="marketing-focus">{item.label}</a>)}</nav>
    </aside>
  );
}
