"use client";

import { useEffect, useRef, useState } from "react";
import { RecordArtifact, RECORD_FIELDS, type RecordPhase } from "@/components/marketing/RecordArtifact";
import { DeptRule } from "@/components/marketing/primitives";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

export type RegistryDepartment = {
  key: string;
  name: string;
  summary: string;
  detail: string;
};

type RecordJourneyProps = {
  departments: readonly RegistryDepartment[];
};

/** The Registry — one record pinned in the right column while departments
 * file past on the left. Each department stamps its field onto the same
 * card; it never swaps out, so the connected-work thesis reads as object
 * continuity rather than a diagram. Below lg or with reduced motion, each
 * row carries an inline plate at its own phase instead. */
export function RecordJourney({ departments }: RecordJourneyProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [phase, setPhase] = useState<RecordPhase>(0);
  const reducedMotion = useMarketingReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const rows = rowRefs.current.filter((row): row is HTMLDivElement => row !== null);
    if (rows.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = rows.indexOf(entry.target as HTMLDivElement);
          if (index >= 0) setPhase(index as RecordPhase);
        });
      },
      // A narrow band across the middle of the viewport decides which
      // department currently holds the record.
      { rootMargin: "-42% 0px -42% 0px", threshold: 0 },
    );
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
      section.style.setProperty("--journey", progress.toFixed(4));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} id="registry" data-testid="record-journey" className="inst-section inst-journey marketing-deferred-section">
      <div className="inst-container">
        <DeptRule name="The registry" note="Sample record shown" />
        <h2 className="inst-display inst-display--section inst-section__head">One file, every department.</h2>
        <div className="inst-journey__grid">
          <div className="inst-journey__depts">
            {departments.map((dept, index) => (
              <div
                key={dept.key}
                ref={(node) => {
                  rowRefs.current[index] = node;
                }}
                className="inst-dept-row"
                data-current={phase === index}
              >
                <div className="inst-dept-row__copy">
                  <h3>{dept.name}</h3>
                  <p><strong>{dept.summary}</strong> {dept.detail}</p>
                  <div className="inst-dept-row__plate" aria-hidden="true">
                    <RecordArtifact phase={index} inline />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <aside className="inst-journey__rail" aria-hidden="true">
            <RecordArtifact phase={phase} />
          </aside>
        </div>
      </div>
      <span className="sr-only">
        The record collects five entries in order: {RECORD_FIELDS.map((f) => `${f.label}: ${f.value}`).join(". ")}.
      </span>
    </section>
  );
}
