import { Fragment, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StartFree } from "@/components/site/StartFree";
import { migrateSignupHref, migrateUnavailable, productPages, type ProductChapter, type ProductPageCopy, type ProductVisual } from "@/content/site/products";
import { Assurance } from "./Assurance";
import { ProductMotion } from "./ProductMotion";
import { ProductVisualView, visualAspect } from "./ProductVisual";
import { SubNav } from "./SubNav";
import styles from "./ProductPage.module.css";

type Theme = "paper" | "ink";

/** A full-width band. When its theme differs from the band above, it carries
 * a bleed layer: ProductMotion wipes that layer in as ink (or paper) pours
 * across the seam. Without motion the layer is simply fully shown. */
function Band({
  id,
  theme,
  prev,
  className = "",
  labelledBy,
  children,
}: {
  id?: string;
  theme: Theme;
  prev: Theme;
  className?: string;
  labelledBy?: string;
  children: ReactNode;
}) {
  const bleeds = theme !== prev;
  return (
    <section
      id={id}
      data-theme={theme}
      data-band
      data-bleeds={bleeds ? theme : undefined}
      aria-labelledby={labelledBy}
      className={`${styles.band} ${className}`}
    >
      {bleeds ? <div className={styles.bleed} data-bleed aria-hidden="true" /> : null}
      {children}
    </section>
  );
}

function HeroTitle({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <h1 className={styles.h1} id="product-title">
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className={styles.wm}>
            <span className={styles.w} style={{ "--i": i } as CSSProperties}>
              {word}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </h1>
  );
}

function sameVisual(a: ProductVisual, b: ProductVisual) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Chapter({
  chapter,
  index,
  total,
  id,
  theme,
  prev,
  heroVisual,
  slug,
}: {
  chapter: ProductChapter;
  index: number;
  total: number;
  id: string;
  theme: Theme;
  prev: Theme;
  heroVisual: ProductVisual;
  slug: ProductPageCopy["slug"];
}) {
  const reversed = index % 2 === 1;
  const importFocus = chapter.visual.kind === "import-steps" && index === 0 && sameVisual(chapter.visual, heroVisual) ? "upload" : "flow";
  return (
    <Band id={id} theme={theme} prev={prev} labelledBy={`${id}-title`} className={styles.chapter}>
      <div className={`s-container--wide s-container ${styles.chapterGrid} ${reversed ? styles.reversed : ""}`} data-chapter data-slug={slug}>
        <div className={styles.text}>
          <p className={`s-kicker ${styles.chapterKicker}`} data-reveal data-kicker>
            <span>{chapter.kicker}</span>
            <span className={styles.count} aria-hidden="true">
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </p>
          <h2 className={styles.h2} id={`${id}-title`} data-reveal data-h2>
            {chapter.title}
          </h2>
          <p className={styles.body} data-reveal data-body>
            {chapter.body}
          </p>
        </div>
        <div className={styles.visualCol}>
          <div className={styles.visualGlow} aria-hidden="true" data-vis-glow />
          <div className={styles.visualStage} data-vis-stage>
            <div className={styles.visualFrame} data-vis-frame data-side={reversed ? "left" : "right"}>
              <ProductVisualView visual={chapter.visual} variant="chapter" importFocus={importFocus} />
            </div>
          </div>
        </div>
      </div>
    </Band>
  );
}

function Tick() {
  return (
    <svg className={styles.tick} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M7 12.5l3.2 3.2L17 8.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" data-tick-path />
    </svg>
  );
}

export function SiteProductPage({ slug, importAvailable = true }: { slug: ProductPageCopy["slug"]; importAvailable?: boolean }) {
  const page = productPages[slug];
  const isMigrate = slug === "migrate";
  const unavailable = isMigrate && !importAvailable;
  const signupHref = isMigrate && importAvailable ? migrateSignupHref : undefined;

  const heroTitle = unavailable ? migrateUnavailable.title : page.hero.title;
  const heroBody = unavailable ? migrateUnavailable.body : page.hero.body;
  const heroVisual: ProductVisual = unavailable ? { kind: "workspace", view: "clients" } : page.hero.visual;

  const includedId = page.sections[page.sections.length - 1]?.id ?? "included";
  const chapterThemes: Theme[] = page.chapters.map((_, i) => (i % 2 === 0 ? "paper" : "ink"));
  const lastChapter: Theme = chapterThemes[chapterThemes.length - 1] ?? "paper";
  const includedTheme: Theme = lastChapter === "paper" ? "ink" : "paper";
  const nextTheme: Theme = "paper";

  const next = page.next;

  return (
    <ProductMotion className={styles.page} sectionIds={page.sections.map((s) => s.id)}>
      <SubNav name={page.name} sections={page.sections} signupHref={signupHref} />

      <section id="product-top" className={styles.hero} data-theme="paper" aria-labelledby="product-title">
        <div className={`s-container s-container--wide ${styles.heroHead}`}>
          <p className={`s-kicker ${styles.heroKicker}`}>{page.hero.kicker}</p>
          <HeroTitle text={heroTitle} />
          <div className={styles.heroRow}>
            <p className={`s-lead ${styles.heroLead}`}>{heroBody}</p>
            <div className={styles.heroCta}>
              <StartFree placement="product_page" size="lg" href={signupHref} />
              <Assurance />
            </div>
          </div>
        </div>
        <div className={styles.heroStage} data-hero-stage style={{ "--hero-aspect": visualAspect(heroVisual) } as CSSProperties}>
          <div className={styles.heroGlow} aria-hidden="true" data-hero-glow />
          <div className={styles.heroFrame} data-hero-frame>
            <ProductVisualView visual={heroVisual} variant="hero" />
          </div>
        </div>
      </section>

      <div className={styles.chapters} data-chapters>
        <div className={styles.thread} aria-hidden="true" data-thread />
        {page.chapters.map((chapter, i) => (
          <Chapter
            key={chapter.title}
            chapter={chapter}
            index={i}
            total={page.chapters.length}
            id={page.sections[i]?.id ?? `chapter-${i + 1}`}
            theme={chapterThemes[i]}
            prev={i === 0 ? "paper" : chapterThemes[i - 1]}
            heroVisual={heroVisual}
            slug={slug}
          />
        ))}
      </div>

      <Band id={includedId} theme={includedTheme} prev={lastChapter} labelledBy="included-title" className={styles.included}>
        <div className={`s-container s-container--wide ${styles.includedGrid}`}>
          <div className={styles.includedHead}>
            <p className="s-kicker" data-reveal data-kicker>
              {page.name}
            </p>
            <h2 className={styles.h2} id="included-title" data-reveal data-h2>
              What&rsquo;s included
            </h2>
          </div>
          <ul className={styles.includes} data-inc-list>
            {page.includes.map((item) => (
              <li key={item} className={styles.includeItem} data-reveal data-inc-item>
                <Tick />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className={styles.notYet}>
            <p className={`s-kicker ${styles.notYetKicker}`} data-reveal data-notyet>
              Not yet
            </p>
            {page.notYet.map((item) => (
              <div key={item.title} className={styles.notYetItem} data-reveal data-notyet>
                <span className={styles.dash} aria-hidden="true" />
                <div>
                  <h3 className={styles.notYetTitle}>{item.title}</h3>
                  <p className={styles.notYetBody}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Band>

      <Band theme={nextTheme} prev={includedTheme} className={styles.nextBand}>
        <div className={`s-container s-container--wide`}>
          <Link href={next.href} className={styles.nextCard} data-next>
            <span className={styles.nextKicker}>Next</span>
            <span className={styles.nextLabel} data-next-label>
              <span>{next.label}</span>
              <ArrowRight className={styles.nextArrow} aria-hidden="true" />
            </span>
            <span className={styles.nextBlurb}>{next.blurb}</span>
            <span className={styles.nextLine} aria-hidden="true" />
          </Link>
        </div>
      </Band>

      <Band theme="ink" prev={nextTheme} className={styles.cta} labelledBy="cta-title">
        <div className={styles.ctaGlow} aria-hidden="true" data-cta-glow />
        <div className={`s-container s-container--wide ${styles.ctaInner}`}>
          <h2 className={styles.ctaTitle} id="cta-title" data-reveal data-h2>
            Start free during beta.
          </h2>
          <div className={styles.ctaActions} data-reveal data-cta-actions>
            <StartFree placement="product_page" size="lg" href={signupHref} />
            <Assurance />
          </div>
        </div>
      </Band>
    </ProductMotion>
  );
}
