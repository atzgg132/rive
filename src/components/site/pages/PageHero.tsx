import { Fragment, type CSSProperties, type ReactNode } from "react";
import styles from "./PageHero.module.css";

/** Page hero shared by the v2 secondary pages. The h1 is plain static HTML:
 * each word rises through a mask with a width-axis settle using CSS keyframes
 * only, so the headline is readable at first paint without any script. */
export function PageHero({ kicker, title, lead, children }: { kicker: string; title: string; lead?: string; children?: ReactNode }) {
  const words = title.split(" ");
  return (
    <header className={styles.hero} data-page-hero>
      <div className={`s-container ${styles.inner}`}>
        <p className={`s-kicker ${styles.kicker}`}>{kicker}</p>
        <h1 className={styles.title}>
          {words.map((word, index) => (
            <Fragment key={`${word}-${index}`}>
              <span className={styles.word}>
                <span className={styles.wordInner} style={{ "--i": index } as CSSProperties}>
                  {word}
                </span>
              </span>
              {index < words.length - 1 ? " " : null}
            </Fragment>
          ))}
        </h1>
        {lead || children ? (
          <div className={styles.foot}>
            {lead ? <p className={`s-lead ${styles.lead}`}>{lead}</p> : null}
            {children}
          </div>
        ) : null}
        <span className={styles.rule} aria-hidden="true" />
      </div>
    </header>
  );
}
