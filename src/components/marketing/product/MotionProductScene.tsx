"use client";

import { AnimatePresence } from "motion/react";
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
      {/* Sync swap, not mode="wait". Wait kept the previous mock in the rail until
          the 200ms exit finished, so 06 / PROOF at 1920 still showed Migration
          Engine and blocked AWS verify. Absolute exit pops the old mock out of
          flow so Portfolio Studio mounts immediately and the column does not
          stack two frames. */}
      <div data-testid="product-scene-motion" className="relative w-full">
        <AnimatePresence initial={false}>
          <m.div
            ref={sceneRef}
            key={sceneKey ?? visual.kind}
            className="w-full"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -14, position: "absolute", top: 0, left: 0, right: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
            onAnimationStart={() => { if (sceneRef.current) sceneRef.current.style.willChange = "transform, opacity"; }}
            onAnimationComplete={() => { if (sceneRef.current) sceneRef.current.style.willChange = "auto"; }}
          >
            <MarketingProductScene visual={visual} />
          </m.div>
        </AnimatePresence>
      </div>
    </MarketingMotionProvider>
  );
}
