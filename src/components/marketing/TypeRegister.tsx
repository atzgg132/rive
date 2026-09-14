"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

/** "The register, in motion" — a departures-board plate. Each department's
 * record rolls through its lifecycle on a drum of characters; every row's
 * terminal state is FILED, and the counter climbs each time one lands. */

const ROWS = [
  { label: "Agreement", states: ["DRAFTED", "SIGNED", "FILED"] },
  { label: "Invoice", states: ["SENT", "PAID", "FILED"] },
  { label: "Project", states: ["STARTED", "DELIVERED", "FILED"] },
  { label: "Portfolio", states: ["DRAFT", "PUBLISHED", "FILED"] },
] as const;

const WIDTH = 9; // DELIVERED / PUBLISHED
const TICK_MS = 3400;
const STEP_MS = 480;
const CHAR_DELAY_MS = 45;

/** For each character position, the glyph it shows in every state, in cycle
 * order, with the first glyph duplicated at the tail — the drum always rolls
 * forward, then resets to 0 without a transition once the copy lands. */
function drums(states: readonly string[]): string[][] {
  return Array.from({ length: WIDTH }, (_, pos) => {
    const glyphs = states.map((word) => word[pos] ?? " ");
    return [...glyphs, glyphs[0]];
  });
}

function Cell({ glyphs, step, pos, jumping }: { glyphs: string[]; step: number; pos: number; jumping: boolean }) {
  return (
    <span className="inst-board__cell">
      <span
        className="inst-board__col"
        style={{
          transform: `translateY(${-step}em)`,
          transition: jumping ? "none" : `transform ${STEP_MS}ms var(--inst-ease) ${pos * CHAR_DELAY_MS}ms`,
        }}
      >
        {glyphs.map((glyph, i) => (
          <span key={i} className="inst-board__glyph">{glyph === " " ? "\u00A0" : glyph}</span>
        ))}
      </span>
    </span>
  );
}

function BoardRow({ label, states, index, reduced, onFiled }: { label: string; states: readonly string[]; index: number; reduced: boolean; onFiled: () => void }) {
  const [step, setStep] = useState(0);
  const [jumping, setJumping] = useState(false);
  const columns = useMemo(() => drums(states), [states]);
  const wrapStep = states.length; // the duplicated first state

  useEffect(() => {
    if (reduced) return;
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => setStep((s) => s + 1), TICK_MS);
    }, index * 850);
    return () => {
      window.clearTimeout(start);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [index, reduced]);

  /* Landing on FILED ticks the ledger. */
  useEffect(() => {
    if (step === states.length - 1) onFiled();
  }, [step, states.length, onFiled]);

  /* On the duplicated tail: let the roll settle, then jump back to 0. */
  useEffect(() => {
    if (step !== wrapStep) return;
    const settle = STEP_MS + (WIDTH - 1) * CHAR_DELAY_MS + 80;
    const timer = window.setTimeout(() => {
      setJumping(true);
      setStep(0);
      requestAnimationFrame(() => requestAnimationFrame(() => setJumping(false)));
    }, settle);
    return () => window.clearTimeout(timer);
  }, [step, wrapStep]);

  const displayStep = reduced ? states.length - 1 : Math.min(step, wrapStep);
  return (
    <div className="inst-board__row" data-filed={displayStep === states.length - 1}>
      <span className="inst-mono inst-board__label">{label}</span>
      <span className="inst-board__drum" aria-hidden="true">
        {columns.map((glyphs, pos) => (
          <Cell key={pos} glyphs={glyphs} step={displayStep} pos={pos} jumping={jumping} />
        ))}
      </span>
    </div>
  );
}

export function TypeRegister() {
  const reduced = useMarketingReducedMotion();
  const [entries, setEntries] = useState(17);
  const onFiled = useCallback(() => setEntries((n) => n + 1), []);
  const padded = String(entries).padStart(3, "0");

  return (
    <div
      className="inst-board"
      data-testid="type-register"
      role="img"
      aria-label="A register board cycling each department's record through its lifecycle; every row ends filed."
    >
      <div className="inst-board__head inst-mono">
        <span>Rive — Register</span>
        <span>Nº {padded}</span>
      </div>
      <div className="inst-board__rows">
        {ROWS.map((row, index) => (
          <BoardRow key={row.label} label={row.label} states={row.states} index={index} reduced={reduced} onFiled={onFiled} />
        ))}
      </div>
      <div className="inst-board__foot inst-mono">
        <span>Entries on record</span>
        <span>{padded} filed</span>
      </div>
    </div>
  );
}
