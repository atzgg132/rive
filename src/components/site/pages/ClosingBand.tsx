import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ASSURANCE, StartFree } from "@/components/site/StartFree";
import styles from "./ClosingBand.module.css";

type Cta = { headline: string; label: string; href: string; note?: string };

/** The ink band that closes a secondary page. Sign-up CTAs are always the
 * shared StartFree; any other destination is a plain link with its own label. */
export function ClosingBand({ cta }: { cta: Cta }) {
  const isSignup = cta.href === "/register";
  return (
    <section data-theme="ink" data-ink data-closing className={styles.band} aria-labelledby="closing-title">
      <svg className={styles.thread} viewBox="0 0 1600 320" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path
          data-thread
          d="M-20 210 C 260 60, 470 330, 800 180 S 1330 40, 1640 170"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className={`s-container ${styles.inner}`}>
        <h2 id="closing-title" data-split data-reveal className={styles.title}>
          {cta.headline}
        </h2>
        <div className={styles.actions} data-fade data-reveal>
          {isSignup ? (
            <>
              <StartFree placement="page" size="lg" />
              <p className={`s-assurance ${styles.note}`}>{ASSURANCE}</p>
            </>
          ) : (
            <>
              <Link href={cta.href} className="s-btn s-btn--lg">
                <span>{cta.label}</span>
                <ArrowRight aria-hidden="true" />
              </Link>
              {cta.note ? <p className={`s-assurance ${styles.note}`}>{cta.note}</p> : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
