import type { SiteProductLink } from "@/content/site/nav";
import styles from "./NavPreview.module.css";

/** Small drawn illustrations for the Product menu. Pure SVG, decorative, and
 * animated only while `active` (the panel is open), and never under reduced
 * motion or "Pause motion" — the rest state is a complete picture. */
export function NavPreview({ kind, active }: { kind: SiteProductLink["preview"]; active: boolean }) {
  return (
    <svg
      className={styles.preview}
      viewBox="0 0 160 100"
      aria-hidden="true"
      focusable="false"
      data-active={active || undefined}
      data-kind={kind}
    >
      <rect className={styles.bg} width="160" height="100" />
      {kind === "clients" ? <Clients /> : null}
      {kind === "agreements" ? <Agreements /> : null}
      {kind === "portfolio" ? <Portfolio /> : null}
      {kind === "import" ? <Import /> : null}
    </svg>
  );
}

function Clients() {
  const rows = [
    { y: 12, w: 62, tone: true },
    { y: 39, w: 48, tone: false },
    { y: 66, w: 56, tone: false },
  ];
  return (
    <g>
      {rows.map((row, index) => (
        <g key={row.y} className={styles.clientRow} style={{ ["--i" as string]: index }}>
          <rect className={styles.card} x="14" y={row.y} width="132" height="22" rx="7" />
          <circle className={row.tone ? styles.dotAccent : styles.dotSoft} cx="28" cy={row.y + 11} r="5.5" />
          <rect className={styles.lineStrong} x="41" y={row.y + 6} width={row.w} height="4" rx="2" />
          <rect className={styles.lineSoft} x="41" y={row.y + 13} width={row.w * 0.6} height="3" rx="1.5" />
          <rect className={styles.pill} x="118" y={row.y + 7} width="20" height="8" rx="4" />
        </g>
      ))}
    </g>
  );
}

function Agreements() {
  return (
    <g>
      <g className={styles.doc}>
        <rect className={styles.card} x="46" y="10" width="68" height="80" rx="7" />
        <rect className={styles.lineStrong} x="56" y="21" width="30" height="4" rx="2" />
        <rect className={styles.lineSoft} x="56" y="31" width="48" height="3" rx="1.5" />
        <rect className={styles.lineSoft} x="56" y="38" width="42" height="3" rx="1.5" />
        <rect className={styles.lineSoft} x="56" y="45" width="46" height="3" rx="1.5" />
        <line className={styles.sign} x1="56" y1="76" x2="88" y2="76" />
      </g>
      <circle className={styles.tickDisc} cx="98" cy="68" r="12" />
      <path className={styles.tick} d="M91.5 68.5 L96.5 73.5 L105.5 62.5" pathLength="1" />
    </g>
  );
}

function Portfolio() {
  return (
    <g>
      <g className={styles.colA}>
        <rect className={styles.tileInk} x="14" y="12" width="40" height="46" rx="5" />
        <rect className={styles.tileSoft} x="14" y="64" width="40" height="30" rx="5" />
      </g>
      <g className={styles.colB}>
        <rect className={styles.tileSoft} x="60" y="12" width="40" height="28" rx="5" />
        <rect className={styles.tileAccent} x="60" y="46" width="40" height="48" rx="5" />
      </g>
      <g className={styles.colC}>
        <rect className={styles.tileCard} x="106" y="12" width="40" height="40" rx="5" />
        <rect className={styles.tileInk} x="106" y="58" width="40" height="36" rx="5" />
      </g>
    </g>
  );
}

function Import() {
  const rows = [14, 34, 54, 74];
  return (
    <g>
      <rect className={styles.card} x="102" y="12" width="46" height="76" rx="7" />
      <rect className={styles.lineStrong} x="110" y="22" width="20" height="4" rx="2" />
      {[34, 44, 54, 64].map((y, index) => (
        <rect key={y} className={styles.filled} style={{ ["--i" as string]: index }} x="110" y={y} width="30" height="4" rx="2" />
      ))}
      {rows.map((y, index) => (
        <g key={y} className={styles.flowRow} style={{ ["--i" as string]: index }}>
          <rect className={styles.card} x="12" y={y} width="50" height="12" rx="4" />
          <rect className={styles.lineStrong} x="18" y={y + 4} width="22" height="4" rx="2" />
          <rect className={styles.lineSoft} x="44" y={y + 4.5} width="12" height="3" rx="1.5" />
        </g>
      ))}
    </g>
  );
}
