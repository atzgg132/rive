"use client";

import { useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

type FaqItem = { question: string; answer: string };

const DURATION_MS = 220;
const EASING = "ease-in-out";

function cancelAnimations(details: HTMLDetailsElement) {
  details.getAnimations().forEach((animation) => animation.cancel());
}

function expand(details: HTMLDetailsElement, animate: boolean) {
  cancelAnimations(details);
  if (!animate) {
    details.open = true;
    return;
  }
  const startHeight = details.offsetHeight;
  details.open = true;
  const endHeight = details.offsetHeight;
  if (endHeight === startHeight) return;
  details.style.overflow = "hidden";
  const animation = details.animate(
    [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
    { duration: DURATION_MS, easing: EASING },
  );
  const done = () => {
    details.style.overflow = "";
  };
  animation.onfinish = done;
  animation.oncancel = done;
}

function collapse(details: HTMLDetailsElement, animate: boolean) {
  cancelAnimations(details);
  if (!animate) {
    details.open = false;
    return;
  }
  const startHeight = details.offsetHeight;
  const endHeight = details.querySelector("summary")?.offsetHeight ?? 0;
  if (endHeight === startHeight) {
    details.open = false;
    return;
  }
  details.style.overflow = "hidden";
  const animation = details.animate(
    [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
    { duration: DURATION_MS, easing: EASING },
  );
  animation.onfinish = () => {
    details.open = false;
    details.style.overflow = "";
  };
  animation.oncancel = () => {
    details.style.overflow = "";
  };
}

export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMarketingReducedMotion();

  function handleSummaryClick(event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
    const details = event.currentTarget.closest("details");
    if (!(details instanceof HTMLDetailsElement)) return;
    const animate = !reducedMotion;
    if (details.open) {
      collapse(details, animate);
      return;
    }
    listRef.current?.querySelectorAll("details[open]").forEach((other) => {
      if (other !== details) collapse(other as HTMLDetailsElement, animate);
    });
    expand(details, animate);
  }

  return (
    <div data-testid="faq-grid" className="inst-enquiries" ref={listRef}>
      {items.map((item, index) => (
        <details key={item.question} open={index === 0}>
          <summary onClick={handleSummaryClick}>
            <span className="inst-mono">0{index + 1}</span>
            <h3>{item.question}</h3>
            <span className="inst-enquiries__glyph" aria-hidden="true">+</span>
          </summary>
          <div>{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
