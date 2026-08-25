"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { MarketingChapter } from "@/content/marketing/home";
import { cn } from "@/lib/utils";

const MotionProductScene = lazy(() => import("@/components/marketing/product/MotionProductScene").then((module) => ({ default: module.MotionProductScene })));

function ProductSceneFallback() {
  return (
    <div aria-hidden="true" className="grid min-h-[31rem] place-items-center overflow-hidden rounded-[1.75rem] border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] p-5">
        <div className="h-2 w-24 rounded-full bg-primary/20" />
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="h-16 rounded-xl bg-[var(--surface-glass)]" />
          <div className="h-16 rounded-xl bg-[var(--surface-glass)]" />
          <div className="h-16 rounded-xl bg-[var(--surface-glass)]" />
        </div>
        <div className="mt-5 h-36 rounded-xl bg-[linear-gradient(135deg,rgb(var(--brand-accent)_/_0.09),var(--surface-glass))]" />
      </div>
    </div>
  );
}

export function DeferredProductScene({ className, eager = false, sceneKey, visual }: { className?: string; eager?: boolean; sceneKey?: string; visual: MarketingChapter["visual"] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(eager);

  useEffect(() => {
    if (eager || shouldLoad) return;
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) {
      const frame = window.requestAnimationFrame(() => setShouldLoad(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const load = () => setShouldLoad(true);
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      load();
      observer.disconnect();
    }, { rootMargin: "600px 0px" });
    observer.observe(root);
    const rect = root.getBoundingClientRect();
    if (rect.bottom > -600 && rect.top < window.innerHeight + 600) load();
    return () => observer.disconnect();
  }, [eager, shouldLoad]);

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
