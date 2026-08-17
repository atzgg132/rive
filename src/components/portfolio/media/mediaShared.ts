export function formatDuration(seconds?: number): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

/**
 * Whether this visitor should be shown motion that starts on its own.
 *
 * Withheld from anyone who asked for reduced motion, and from anyone on a
 * metered connection, because starting a video unprompted spends the visitor's
 * data as well as this app's egress.
 *
 * Takes no settings so callers can depend on the owner's flag separately —
 * passing a settings object into an effect dependency rebuilt observers on
 * every render.
 */
export function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !connection?.saveData;
}

export const MEDIA_SURFACE = "overflow-hidden rounded-[var(--portfolio-radius)] border border-[var(--portfolio-border)] bg-[var(--portfolio-soft)]";
