"use client";

import { ASSURANCE } from "@/components/site/StartFree";

/** ASSURANCE is exported from a client module, so server components render
 * it through this wrapper instead of importing the string. */
export function Assurance({ className = "" }: { className?: string }) {
  return <p className={`s-assurance ${className}`}>{ASSURANCE}</p>;
}
