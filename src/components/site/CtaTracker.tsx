"use client";

import { useEffect } from "react";
import { trackCtaClick } from "@/components/site/analytics";
import { MARKETING_CTA_PLACEMENT_SET, type MarketingCtaPlacement } from "@/lib/domain-vocabulary";

/** Records every Start free click. It listens on window in the capture
 * phase because the auth overlay intercepts /register clicks on document
 * (also capture) and stops propagation, so a React onClick never runs. */
export function CtaTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const placement = target.closest<HTMLElement>("[data-cta-placement]")?.dataset.ctaPlacement;
      if (placement && MARKETING_CTA_PLACEMENT_SET.has(placement)) trackCtaClick(placement as MarketingCtaPlacement);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
