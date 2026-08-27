"use client";

import type { MarketingChapter } from "@/content/marketing/home";
import { MarketingProductScene } from "@/components/marketing/product/SceneRegistry";

export function MotionProductScene({ sceneKey, visual }: { sceneKey?: string; visual: MarketingChapter["visual"] }) {
  return (
    <div data-testid="product-scene-motion" key={sceneKey ?? visual.kind} className="marketing-scene-in w-full">
      <MarketingProductScene visual={visual} />
    </div>
  );
}
