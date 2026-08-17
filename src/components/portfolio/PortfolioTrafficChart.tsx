"use client";

import { useMemo, useState } from "react";

/**
 * Daily traffic.
 *
 * The count used to live in a floating tooltip anchored above each bar. Inside
 * a horizontally scrollable plot that was unreadable: a scroll container clips
 * on both axes, so the pill was cut off by the top edge exactly when you hovered
 * the tall bars you actually cared about. Before that it was a native `title`,
 * which lagged and did nothing on touch.
 *
 * The readout is now a fixed line above the plot. It cannot be clipped, it needs
 * no positioning maths, it reads the same on a phone as on a desktop, and it
 * holds its value after a tap instead of vanishing with the pointer.
 */

export type TrafficPoint = { day: string; views: number };

/** Bar slot width: wide enough to hit with a thumb, scrolling rather than shrinking. */
const MIN_SLOT_PX = 16;

function formatDay(day: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
}

/** A rounded ceiling, so the top gridline reads 20 rather than 18. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  if (value <= 5) return value;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
}

/** Evenly spaced label positions including both ends, without crowding. */
function tickIndexes(length: number, desired: number): number[] {
  if (length <= 1) return length === 1 ? [0] : [];
  const count = Math.max(2, Math.min(desired, length));
  const step = (length - 1) / (count - 1);
  return Array.from({ length: count }, (_, index) => Math.round(index * step)).filter(
    (value, index, all) => all.indexOf(value) === index,
  );
}

export default function PortfolioTrafficChart({ points, totalViews }: { points: TrafficPoint[]; totalViews: number }) {
  const [active, setActive] = useState<number | null>(null);

  const max = useMemo(() => niceCeiling(Math.max(...points.map((point) => point.views), 0)), [points]);
  const ticks = useMemo(() => tickIndexes(points.length, points.length > 45 ? 4 : 5), [points]);
  const peakIndex = useMemo(() => {
    let best = -1;
    points.forEach((point, index) => {
      if (point.views > 0 && (best === -1 || point.views > points[best].views)) best = index;
    });
    return best;
  }, [points]);

  if (points.length === 0) return null;

  const shown = active !== null ? active : peakIndex;
  const shownPoint = shown >= 0 ? points[shown] : null;
  const summary = `Daily views from ${formatDay(points[0].day)} to ${formatDay(points[points.length - 1].day)}, ${totalViews} in total.`;

  return (
    <figure className="m-0">
      {/* Fixed-height readout: always visible, never clipped, holds after a tap. */}
      <div
        data-traffic-readout
        aria-live="polite"
        className="mb-3 flex min-h-9 flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-muted/50 px-3 py-2"
      >
        {shownPoint ? (
          <>
            <span className="text-lg font-black tabular-nums leading-none text-foreground">{shownPoint.views}</span>
            <span className="text-xs font-semibold text-foreground">view{shownPoint.views === 1 ? "" : "s"}</span>
            <span className="text-xs text-muted-foreground">
              on {formatDay(shownPoint.day, { weekday: "short", month: "short", day: "numeric" })}
              {active === null && " · busiest day"}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">No views recorded in this range.</span>
        )}
      </div>

      <div className="flex gap-2 sm:gap-3">
        {/* Axis outside the scroller, so the scale stays put while panning. */}
        <div className="relative h-44 w-7 shrink-0 sm:h-56 sm:w-9" aria-hidden="true">
          {[1, 0.5, 0].map((fraction) => (
            <span
              key={fraction}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ top: `${(1 - fraction) * 100}%` }}
            >
              {Math.round(max * fraction)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          {/* pr-px keeps the final bar off the container's clipping edge. */}
          <div className="pr-px" style={{ minWidth: `${points.length * MIN_SLOT_PX}px` }}>
            <div className="relative h-44 sm:h-56" onPointerLeave={() => setActive(null)}>
              {[1, 0.5, 0].map((fraction) => (
                <span
                  key={fraction}
                  aria-hidden="true"
                  className={`absolute inset-x-0 border-t ${fraction === 0 ? "border-border" : "border-dashed border-border/50"}`}
                  style={{ top: `${(1 - fraction) * 100}%` }}
                />
              ))}

              <div className="absolute inset-0 flex items-end gap-px" role="img" aria-label={summary}>
                {points.map((point, index) => (
                  <div
                    key={point.day}
                    data-traffic-bar={point.day}
                    className="relative flex h-full flex-1 cursor-default items-end"
                    onPointerEnter={() => setActive(index)}
                    onClick={() => setActive(index)}
                  >
                    {/* Full-height hit area so thin bars stay easy to target. */}
                    <span className="absolute inset-0" aria-hidden="true" />
                    <span
                      className={`w-full rounded-t-[3px] transition-colors ${
                        active === index ? "bg-primary" : point.views > 0 ? "bg-primary/55" : "bg-border"
                      }`}
                      style={{ height: point.views > 0 ? `${Math.max((point.views / max) * 100, 3)}%` : "2px" }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mt-2 h-4">
              {ticks.map((index) => (
                <span
                  key={index}
                  className="absolute whitespace-nowrap text-[10px] text-muted-foreground"
                  style={{
                    left: `${((index + 0.5) / points.length) * 100}%`,
                    transform:
                      index === 0 ? "translateX(0)" : index === points.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                  }}
                >
                  {formatDay(points[index].day)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <figcaption className="sr-only">
        {summary}
        <table>
          <caption>Daily portfolio views</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Views</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.day}>
                <th scope="row">{formatDay(point.day)}</th>
                <td>{point.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
