"use client";

import { useCallback, useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(query).matches;
const getServerSnapshot = () => false;
const subscribeToHydration = () => () => undefined;

/**
 * Motion's media-query value can differ between the server render and the
 * browser's first hydration pass. Keep that first pass deterministic, then
 * expose the real preference immediately after hydration.
 */
export function useMarketingReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useMarketingHydrated() {
  return useSyncExternalStore(subscribeToHydration, () => true, getServerSnapshot);
}

export function useMarketingMediaQuery(mediaQuery: string) {
  const subscribeToQuery = useCallback((onChange: () => void) => {
    const media = window.matchMedia(mediaQuery);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mediaQuery]);
  const readQuery = useCallback(() => window.matchMedia(mediaQuery).matches, [mediaQuery]);
  return useSyncExternalStore(subscribeToQuery, readQuery, getServerSnapshot);
}
