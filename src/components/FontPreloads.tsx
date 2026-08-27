"use client";

import ReactDOM from "react-dom";

const FONT_PRELOADS = [
  "/fonts/outfit-marketing.woff2",
  "/fonts/jetbrains-mono-marketing.woff2",
] as const;

export function FontPreloads() {
  for (const href of FONT_PRELOADS) {
    ReactDOM.preload(href, {
      as: "font",
      type: "font/woff2",
      crossOrigin: "anonymous",
    });
  }

  return null;
}
