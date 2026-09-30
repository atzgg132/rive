"use client";

import { useId, useState } from "react";
import styles from "./Faq.module.css";

type FaqItem = { readonly question: string; readonly answer: string };

/** One-open-at-a-time accordion. Panels animate with grid-template-rows so
 * height is never measured or animated in JS; closed panels are `inert`, so
 * their content is out of the tab order and the accessibility tree. */
export function Faq({ items, label }: { items: readonly FaqItem[]; label: string }) {
  const base = useId();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className={styles.faq} role="group" aria-label={label} data-faq>
      {items.map((item, index) => {
        const expanded = open === index;
        const buttonId = `${base}-q-${index}`;
        const panelId = `${base}-a-${index}`;
        return (
          <div key={item.question} className={styles.item} data-open={expanded ? "" : undefined} data-faq-item>
            <h3 className={styles.heading}>
              <button
                type="button"
                id={buttonId}
                className={styles.trigger}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : index)}
              >
                <span>{item.question}</span>
                <span className={styles.icon} aria-hidden="true" />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} className={styles.panel} inert={!expanded}>
              <div className={styles.inner}>
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
