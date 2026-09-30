"use client";

import { useSyncExternalStore } from "react";
import { MOTION_PAUSED_ATTR as ATTR, MOTION_PAUSED_STORAGE_KEY as STORAGE_KEY } from "@/components/site/motion/boot";

const EVENT = "rive-site-motion-paused";

/** One site-wide "Pause motion" state for every loop longer than 5s (the
 * WebGL ink, ambient drifts). Scroll-linked animation is not a loop and is
 * not affected. Persisted so the choice survives navigation and reloads. */
export function setMotionPaused(paused: boolean) {
  const root = document.documentElement;
  if (paused) root.setAttribute(ATTR, "");
  else root.removeAttribute(ATTR);
  try {
    window.localStorage.setItem(STORAGE_KEY, paused ? "1" : "0");
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function readMotionPaused(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.hasAttribute(ATTR);
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useMotionPaused(): boolean {
  return useSyncExternalStore(subscribe, readMotionPaused, () => false);
}
