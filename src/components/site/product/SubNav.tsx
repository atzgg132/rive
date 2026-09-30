import { StartFree } from "@/components/site/StartFree";
import styles from "./SubNav.module.css";

/** The product page's sticky sub-bar. The active link and the paper/ink tone
 * are driven by ProductMotion through data attributes. */
export function SubNav({
  name,
  sections,
  signupHref,
}: {
  name: string;
  sections: { id: string; label: string }[];
  signupHref?: "/register" | `/register?${string}`;
}) {
  return (
    <div className={styles.bar} data-subbar data-tone="paper">
      <div className={styles.inner}>
        <a className={styles.name} href="#product-top">
          {name}
        </a>
        <nav className={styles.nav} aria-label={`${name}, on this page`}>
          <ul className={styles.list} data-sub-list>
            {sections.map((section) => (
              <li key={section.id}>
                <a className={styles.link} href={`#${section.id}`} data-sub-link={section.id}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.cta}>
          <StartFree placement="product_page" href={signupHref} />
        </div>
      </div>
    </div>
  );
}
