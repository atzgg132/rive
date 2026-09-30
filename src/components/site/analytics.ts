"use client";

import type { MarketingCtaPlacement } from "@/lib/domain-vocabulary";

/** Fire-and-forget: a CTA click must never wait on, or fail because of,
 * analytics. `keepalive` lets the request outlive the overlay navigation. */
export function trackCtaClick(placement: MarketingCtaPlacement) {
  try {
    void fetch("/api/track/cta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placement, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Tracking never breaks the page.
  }
}
