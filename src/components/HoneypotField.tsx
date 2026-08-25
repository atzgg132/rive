"use client";

import { useEffect, useRef, type Ref } from "react";

/**
 * Opened-at stamp for the public-form dwell check. Recorded after mount so
 * render stays pure (`Date.now` during render fails `react-hooks/purity`).
 * A person filling the form always outlasts the two-second minimum; a JSON
 * crawler that never loads this component never sends a stamp at all.
 */
export function usePublicFormOpenedAt() {
  const startedAtRef = useRef(0);
  const websiteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  return { startedAtRef, websiteRef };
}

/**
 * Hidden field named `website`. Autofill bots populate it; people using the
 * visible form never see it. Kept out of React state so it is not serialized
 * with the rest of the form by accident.
 */
export default function HoneypotField({ inputRef }: { inputRef: Ref<HTMLInputElement> }) {
  return (
    <label className="hidden" aria-hidden="true">
      Website
      <input ref={inputRef} name="website" tabIndex={-1} autoComplete="off" />
    </label>
  );
}
