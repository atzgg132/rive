"use client";

import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";

const loadFeatures = () => import("@/components/marketing/motion-features").then((module) => module.default);

export function MarketingMotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures} strict>{children}</LazyMotion>;
}
