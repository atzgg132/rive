import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import type { MarketingPageContent } from "@/content/marketing/pages";
import { cn } from "@/lib/utils";
import { DeptRule, InstMark, MarketingButton } from "@/components/marketing/primitives";

export function SectionShell({ children, id, className, innerClassName, clipX = true }: { children: ReactNode; id?: string; className?: string; innerClassName?: string; clipX?: boolean }) {
  return <section id={id} className={cn("inst-section", className)}><div className={cn("inst-container min-w-0", clipX && "overflow-x-clip", innerClassName)}>{children}</div></section>;
}

/** Reading-page hero: the register head every secondary route opens with. */
export function ReadingHero({ eyebrow, title, intro }: { eyebrow: string; title: ReactNode; intro?: ReactNode }) {
  return (
    <section className="inst-reading">
      <div className="inst-container inst-reading__head">
        <span className="inst-mono"><InstMark mark="circle" accent />{eyebrow}</span>
        <h1 className="inst-display" style={{ marginTop: "1.25rem" }}>{title}</h1>
        {intro ? <p className="inst-body">{intro}</p> : null}
      </div>
    </section>
  );
}

/** Closing plate shared by secondary pages. */
export function ClosingCta({ headline, note, href, label }: { headline: ReactNode; note?: ReactNode; href: string; label: string }) {
  return (
    <section className="inst-band inst-band--ink inst-closing">
      <div className="inst-container inst-closing__grid">
        <div>
          <h2 className="inst-display inst-display--section">{headline}</h2>
          {note ? <p className="inst-body" style={{ marginTop: "1.25rem" }}>{note}</p> : null}
          <div className="inst-closing__action">
            <MarketingButton href={href}>{label}</MarketingButton>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MarketingPage({ content }: { content: MarketingPageContent }) {
  return (
    <>
      <ReadingHero eyebrow={content.eyebrow} title={content.title} intro={content.intro} />
      <div>
        {content.sections.map((section, sectionIndex) => (
          <section key={section.title} className="inst-section">
            <div className="inst-container">
              <DeptRule index={String(sectionIndex + 1).padStart(2, "0")} name={section.eyebrow ?? `Entry ${sectionIndex + 1}`} />
              <div className="inst-entry">
                <h2 className="inst-display inst-display--sub inst-entry__title">{section.title}</h2>
                <div className="inst-entry__body">
                  {section.body ? <p className="inst-body">{section.body}</p> : null}
                  {section.cards?.length ? (
                    <div className="inst-entry__cards">
                      {section.cards.map((card, index) => (
                        <article key={card.title} className="inst-panel">
                          <span className="inst-mono inst-panel__label">{String(index + 1).padStart(2, "0")}{card.meta ? ` — ${card.meta}` : ""}</span>
                          <h3 className="inst-entry__card-title">{card.title}</h3>
                          <p className="inst-entry__card-body">{card.body}</p>
                          {card.href ? <Link href={card.href} className="marketing-focus inst-link">Read more <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link> : null}
                        </article>
                      ))}
                    </div>
                  ) : null}
                  {section.bullets?.length ? (
                    <ol className="inst-admit__list">
                      {section.bullets.map((bullet, index) => <li key={bullet}><span className="inst-mono">{String(index + 1).padStart(2, "0")}</span><p>{bullet}</p></li>)}
                    </ol>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
      {content.cta ? <ClosingCta headline={content.cta.headline} note={content.cta.note} href={content.cta.href} label={content.cta.label} /> : null}
    </>
  );
}

export function IndexShell({ children, eyebrow, title, intro }: { children: ReactNode; eyebrow: string; title: string; intro: string }) {
  return <><ReadingHero eyebrow={eyebrow} title={title} intro={intro} /><SectionShell clipX={false}>{children}</SectionShell></>;
}

export function ProseShell({ eyebrow, title, children, updated }: { eyebrow: string; title: string; children: ReactNode; updated?: string }) {
  return (
    <section className="inst-reading">
      <div className="inst-container">
        <div className="inst-reading__head">
          <span className="inst-mono"><InstMark mark="circle" accent />{eyebrow}</span>
          <h1 className="inst-display" style={{ marginTop: "1.25rem" }}>{title}</h1>
          {updated ? <p className="inst-mono" style={{ marginTop: "1.25rem", color: "var(--inst-ink-faint)" }}>{updated}</p> : null}
        </div>
        <div className="inst-reading__body">{children}</div>
      </div>
    </section>
  );
}

export function LegalToc({ items }: { items: readonly { id: string; label: string }[] }) {
  return (
    <aside className="inst-toc">
      <p className="inst-mono">On this page</p>
      <nav aria-label="On this page">{items.map((item) => <a key={item.id} href={`#${item.id}`} className="marketing-focus">{item.label}</a>)}</nav>
    </aside>
  );
}
