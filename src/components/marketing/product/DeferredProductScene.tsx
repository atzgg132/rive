"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { MarketingChapter } from "@/content/marketing/home";
import { cn } from "@/lib/utils";

const MotionProductScene = lazy(() => import("@/components/marketing/product/MotionProductScene").then((module) => ({ default: module.MotionProductScene })));

function ProductSceneFallback() {
  return (
    <div aria-hidden="true" className="grid min-h-[31rem] place-items-center overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-[#0a0e16] p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.07] bg-[#101722] p-5">
        <div className="h-2 w-24 rounded-full bg-blue-300/20" />
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="h-16 rounded-xl bg-white/[0.04]" />
          <div className="h-16 rounded-xl bg-white/[0.04]" />
          <div className="h-16 rounded-xl bg-white/[0.04]" />
        </div>
        <div className="mt-5 h-36 rounded-xl bg-[linear-gradient(135deg,rgba(59,130,246,.09),rgba(255,255,255,.025))]" />
      </div>
    </div>
  );
}

export function DeferredProductScene({ className, sceneKey, visual }: { className?: string; sceneKey?: string; visual: MarketingChapter["visual"] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) {
      const frame = window.requestAnimationFrame(() => setShouldLoad(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setShouldLoad(true);
      observer.disconnect();
    }, { rootMargin: "600px 0px" });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} data-deferred-motion className={cn("min-h-[31rem]", className)}>
      {shouldLoad ? (
        <Suspense fallback={<ProductSceneFallback />}>
          <MotionProductScene sceneKey={sceneKey} visual={visual} />
        </Suspense>
      ) : <ProductSceneFallback />}
    </div>
  );
}
