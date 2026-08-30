import { preload } from "react-dom";

/* Server-only so React emits HTTP Link preloads on the document response
   (TTFB), not only <link> tags after the HTML body. Outfit is the hero/LCP
   face; Mono is labels and stays low-priority so it cannot win the first hop. */
const FONT_PRELOADS = [
  { href: "/fonts/outfit-marketing.woff2", fetchPriority: "high" },
  { href: "/fonts/jetbrains-mono-marketing.woff2", fetchPriority: "low" },
] as const;

export function FontPreloads() {
  for (const { href, fetchPriority } of FONT_PRELOADS) {
    preload(href, {
      as: "font",
      type: "font/woff2",
      crossOrigin: "anonymous",
      fetchPriority,
    });
  }

  return null;
}
