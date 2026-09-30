import { ResponsiveWorkspacePreview } from "@/components/marketing/ResponsiveWorkspacePreview";
import { ResponsivePlate } from "@/components/marketing/ResponsivePlate";
import { AcceptanceDocument } from "@/components/marketing/AcceptanceDocument";
import { InvoiceDocument } from "@/components/marketing/InvoiceDocument";
import { PortfolioSpecimen } from "@/components/marketing/PortfolioShowcase";
import { SpecimenFrame } from "@/components/marketing/SpecimenFrame";
import type { ProductVisual as ProductVisualCopy } from "@/content/site/products";
import { ImportSteps } from "./ImportSteps";
import styles from "./ProductVisual.module.css";

export type VisualVariant = "hero" | "chapter";

/** Width / height the hero stage should assume, so a large visual never grows
 * taller than the viewport. */
export function visualAspect(visual: ProductVisualCopy): number {
  switch (visual.kind) {
    case "workspace":
      return 1.55;
    case "acceptance":
      return 1.25;
    case "invoice":
      return 0.9;
    case "portfolio-site":
      return 1.45;
    case "import-steps":
      return 1.9;
  }
}

function Sample() {
  return (
    <p className={styles.sample}>
      <span className="s-sample-label">Sample studio</span>
    </p>
  );
}

function Body({ visual, variant, importFocus }: { visual: ProductVisualCopy; variant: VisualVariant; importFocus: "flow" | "upload" }) {
  switch (visual.kind) {
    case "workspace":
      return (
        <div className={styles.window}>
          <div data-par="drift" className={styles.par}>
            <ResponsiveWorkspacePreview view={visual.view} />
          </div>
        </div>
      );

    case "acceptance":
      if (variant === "hero") {
        return (
          <div className={styles.acceptHero}>
            <div className={styles.acceptHeroScreen}>
              <div data-par="drift" className={styles.par}>
                <ResponsivePlate wide={{ w: 1024, h: 800 }} narrow={{ w: 460, h: 980 }}>
                  <AcceptanceDocument />
                </ResponsivePlate>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className={styles.phone}>
          <div className={styles.screen}>
            <span className={styles.island} aria-hidden="true" />
            <div data-par="drift" className={styles.par}>
              <ResponsivePlate wide={{ w: 460, h: 980 }} narrow={{ w: 460, h: 980 }}>
                <AcceptanceDocument />
              </ResponsivePlate>
            </div>
          </div>
        </div>
      );

    case "invoice":
      return (
        <div className={styles.sheetWrap}>
          <div className={styles.sheetTilt}>
            <div className={styles.sheet}>
              <div data-par="drift" className={styles.par}>
                <ResponsivePlate wide={{ w: 780, h: 900 }} narrow={{ w: 430, h: 1000 }} breakpoint={480}>
                  <InvoiceDocument />
                </ResponsivePlate>
              </div>
            </div>
          </div>
        </div>
      );

    case "portfolio-site":
      return (
        <div className={styles.browser}>
          <div className={styles.chrome} aria-hidden="true">
            <i />
            <i />
            <i />
            <span className={styles.addr} />
          </div>
          <div className={styles.viewport}>
            <div data-par="scroll" className={styles.scroll}>
              <SpecimenFrame>
                <PortfolioSpecimen templateKey={visual.templateKey} opening />
              </SpecimenFrame>
            </div>
          </div>
        </div>
      );

    case "import-steps":
      return <ImportSteps focus={importFocus} />;
  }
}

/** One product visual, built from the real product components. The frame
 * carries the data attributes ProductMotion animates. */
export function ProductVisualView({
  visual,
  variant,
  importFocus = "flow",
}: {
  visual: ProductVisualCopy;
  variant: VisualVariant;
  importFocus?: "flow" | "upload";
}) {
  return (
    <div className={styles.visual} data-kind={visual.kind}>
      <Body visual={visual} variant={variant} importFocus={importFocus} />
      <Sample />
    </div>
  );
}
