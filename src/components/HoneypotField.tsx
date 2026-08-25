"use client";

import type { Ref } from "react";

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
