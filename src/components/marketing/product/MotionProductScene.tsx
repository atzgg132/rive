"use client";

import * as m from "motion/react-m";
import { useRef } from "react";
import type { MarketingChapter } from "@/content/marketing/home";
import { MarketingMotionProvider } from "@/components/marketing/MarketingMotionProvider";
import { MarketingProductScene } from "@/components/marketing/product/SceneRegistry";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

export function MotionProductScene({ sceneKey, visual }: { sceneKey?: string; visual: MarketingChapter["visual"] }) {
  const reduceMotion = useMarketingReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);

  return (
    <MarketingMotionProvider>
      {/* Keyed enter, not AnimatePresence wait/sync. Wait left the previous mock
          in the rail at 1920. Sync+absolute exit never finished leaving, so 06 /
          PROOF stacked THIS MORNING'S REBUILD on Portfolio Studio. Unmount the
          old mock immediately and animate the new one in so the last beat is
          only Portfolio Studio and inner rows still run their stagger. */}
      <m.div
        ref={sceneRef}
        data-testid="product-scene-motion"
        key={sceneKey ?? visual.kind}
        className="w-full"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
        onAnimationStart={() => { if (sceneRef.current) sceneRef.current.style.willChange = "transform, opacity"; }}
        onAnimationComplete={() => { if (sceneRef.current) sceneRef.current.style.willChange = "auto"; }}
      >
        <MarketingProductScene visual={visual} />
      </m.div>
    </MarketingMotionProvider>
  );
}
