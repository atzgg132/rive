"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui";
import { inputClass, labelClass } from "@/components/portfolio/studio/studioStyles";
import { HEX_COLOR_PATTERN, PORTFOLIO_TEMPLATES, normalizeHexColor } from "@/utils/portfolio";

const PRESET_ACCENTS = [...new Set(PORTFOLIO_TEMPLATES.map((template) => template.accent.toUpperCase()))];

type Props = {
  value: string;
  onChange: (accent: string) => void;
  label?: string;
};

/**
 * Native `<input type="color">` going through the shared Input styles was a
 * dead control: `display: flex` plus padding shrinks the colour well to a few
 * unclickable pixels, and a change that only shows up in a hidden preview reads
 * as a no-op. This is a real swatch you can hit, a hex field, and a live chip
 * in the same row as the control.
 */
export default function AccentColorField({ value, onChange, label = "Accent" }: Props) {
  const hex = normalizeHexColor(value);
  const colorId = useId();
  const hexId = useId();
  const [hexDraft, setHexDraft] = useState(hex);
  const [editingHex, setEditingHex] = useState(false);

  const commit = (next: string) => {
    const normalized = normalizeHexColor(next, hex);
    setHexDraft(normalized);
    if (normalized !== hex) onChange(normalized);
  };

  return (
    <div data-accent-picker className="flex flex-col gap-2 sm:col-span-1">
      <span className={labelClass}>{label}</span>
      <div className="flex items-center gap-3">
        <label
          htmlFor={colorId}
          className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700"
          style={{ backgroundColor: hex }}
          title="Choose accent colour"
        >
          <input
            id={colorId}
            type="color"
            value={hex}
            aria-label={label}
            onInput={(event) => commit(event.currentTarget.value)}
            onChange={(event) => commit(event.currentTarget.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          id={hexId}
          className={`${inputClass} font-mono uppercase`}
          value={editingHex ? hexDraft : hex}
          spellCheck={false}
          maxLength={7}
          aria-label={`${label} hex value`}
          onFocus={() => {
            setHexDraft(hex);
            setEditingHex(true);
          }}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            setHexDraft(next);
            if (HEX_COLOR_PATTERN.test(next)) onChange(next);
          }}
          onBlur={() => {
            commit(hexDraft);
            setEditingHex(false);
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PRESET_ACCENTS.map((accent) => {
          const selected = accent === hex;
          return (
            <button
              key={accent}
              type="button"
              aria-label={`Use ${accent}`}
              aria-pressed={selected}
              title={accent}
              onClick={() => commit(accent)}
              className={`h-7 w-7 rounded-full border border-black/10 shadow-sm transition dark:border-white/15 ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "hover:scale-105"}`}
              style={{ backgroundColor: accent }}
            />
          );
        })}
      </div>
      <p
        data-accent-sample
        className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold text-white"
        style={{ backgroundColor: hex }}
      >
        Accent applies here
      </p>
    </div>
  );
}
