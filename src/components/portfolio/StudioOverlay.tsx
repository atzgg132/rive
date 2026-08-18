"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * One full-screen layer, with the parts that are easy to get wrong done once.
 *
 * The studio's first overlay was rendered in place, inside the editor column. It
 * was genuinely full-viewport and still buried: the sticky app header, the
 * publish bar and the feedback launcher all painted over it, and its own
 * controls sat behind the header. Raising the z-index does nothing, because a
 * positioned ancestor establishes a stacking context and everything inside it is
 * capped by that ancestor's own level. The layer has to leave the subtree, which
 * means a portal — so every overlay in here goes through this component rather
 * than each one rediscovering that.
 *
 * It also owns the things a modal layer owes the keyboard: focus moves in, is
 * trapped while open, and returns to whatever opened it; Escape closes; the page
 * behind is scroll-locked so a wheel over the backdrop does not move it. No
 * entry animation, which is the simplest way to honour reduced motion.
 */

/**
 * Above every layer the workspace puts on screen — sticky headers at 30, the
 * publish bar at 20, the feedback launcher at 40 and its modal at 120 — and
 * deliberately below the toast layer at 9999, so a save error still reaches
 * someone who is mid-overlay.
 */
export const STUDIO_OVERLAY_Z = "z-[200]";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function StudioOverlay({
  label,
  onClose,
  className = "",
  children,
}: {
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /* Held in a ref so the effect below does not depend on it. Callers pass inline
     arrows — a new function every parent render — and re-running this effect
     would restore focus to the opener and then pull it back to the first
     control, over and over, while someone typed elsewhere on the page. */
  const closeRef = useRef(onClose);
  /* Synced in an effect rather than during render — writing a ref while
     rendering is not safe under concurrent rendering. The initial value is
     already correct, so the layer never holds a stale handler. */
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const overlay = ref.current;
    if (!overlay) return;

    const restoreTo = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.offsetParent !== null);
    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !overlay.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreTo?.focus?.();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal
      aria-label={label}
      className={`fixed inset-0 ${STUDIO_OVERLAY_Z} flex flex-col bg-slate-950/80 backdrop-blur-md ${className}`}
    >
      {/* Behind the content, so a click on the surround closes while a click on
          the controls inside does not. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => closeRef.current()}
        className="absolute inset-0 -z-10 cursor-default"
      />
      {children}
    </div>,
    document.body,
  );
}
