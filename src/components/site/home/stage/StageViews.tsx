"use client";

import { memo, useLayoutEffect, useRef, useState } from "react";
import { AcceptanceDocument } from "@/components/marketing/AcceptanceDocument";
import { AppWindowFrame, FluidAppWindow } from "@/components/marketing/AppWindowFrame";
import { InvoiceDocument } from "@/components/marketing/InvoiceDocument";
import { PortfolioSpecimen } from "@/components/marketing/PortfolioShowcase";
import { SpecimenFrame } from "@/components/marketing/SpecimenFrame";
import { WorkspacePreview, type WorkspacePreviewView } from "@/components/marketing/WorkspacePreview";
import { WorkspacePreviewCompact } from "@/components/marketing/WorkspacePreviewCompact";
import type { StageView } from "@/content/site/home";
import styles from "./StageViews.module.css";

/* The real product surfaces the stage morphs between. Everything here wraps
   the marketing components; nothing restyles their internals. */

/** Sample invoice total, as printed in InvoiceDocument. The stage counts an
 * overlay up to it; it is not a new figure. */
export const INVOICE_TOTAL = 90000;

const WIDE_MIN = 768;
const SCALED_MIN = 440;
const SCALED_DOC_WIDTH = 1000;

function WorkspaceStageView({ view }: { view: WorkspacePreviewView }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { w, h } = size;
  let body = null;
  if (w > 0 && h > 0) {
    if (w >= WIDE_MIN) {
      body = (
        <FluidAppWindow aspect={w / h} className={styles.fill}>
          <WorkspacePreview view={view} />
        </FluidAppWindow>
      );
    } else if (w >= SCALED_MIN) {
      body = (
        <AppWindowFrame docWidth={SCALED_DOC_WIDTH} docHeight={Math.round((SCALED_DOC_WIDTH * h) / w)} className={styles.fill}>
          <WorkspacePreview view={view} />
        </AppWindowFrame>
      );
    } else {
      body = (
        <FluidAppWindow aspect={w / h} className={styles.fill}>
          <WorkspacePreviewCompact view={view} />
        </FluidAppWindow>
      );
    }
  }
  return (
    <div ref={ref} className={styles.fill}>
      {body}
    </div>
  );
}

function PaperInvoice() {
  return (
    <div className={styles.desk}>
      <div className={styles.paper} data-paper>
        <AppWindowFrame docWidth={780} docHeight={900}>
          <InvoiceDocument />
        </AppWindowFrame>
      </div>
      <div className={styles.amount} data-amount-chip aria-hidden="true">
        <span className={styles.amountLabel}>Amount due</span>
        <span className={styles.amountValue} data-amount>
          ₹{INVOICE_TOTAL.toLocaleString("en-IN")}
        </span>
        <span className={styles.amountNote}>Sample invoice</span>
      </div>
    </div>
  );
}

function BrowserPortfolio() {
  return (
    <div className={styles.browser}>
      <div className={styles.chrome} aria-hidden="true">
        <span className={styles.chromeDots}>
          <i />
          <i />
          <i />
        </span>
        <span className={styles.chromeUrl}>Sample portfolio</span>
      </div>
      <div className={styles.viewport}>
        <SpecimenFrame>
          <PortfolioSpecimen templateKey="minimal-pro" opening />
        </SpecimenFrame>
      </div>
    </div>
  );
}

/** The client's acceptance page inside a drawn phone. */
export const PhoneAcceptance = memo(function PhoneAcceptance() {
  return (
    <div className={styles.phone} data-phone-device>
      <div className={styles.phoneBody}>
        <span className={styles.island} />
        <div className={styles.phoneScreen}>
          <AppWindowFrame docWidth={460} docHeight={980}>
            <AcceptanceDocument />
          </AppWindowFrame>
        </div>
      </div>
    </div>
  );
});

/** Content of a non-phone stage layer. */
export const StageContent = memo(function StageContent({ view }: { view: Exclude<StageView, "acceptance"> }) {
  switch (view) {
    case "invoice":
      return <PaperInvoice />;
    case "portfolio":
      return <BrowserPortfolio />;
    default:
      return <WorkspaceStageView view={view} />;
  }
});
