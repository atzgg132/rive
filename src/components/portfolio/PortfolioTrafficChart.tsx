"use client";

import { useMemo, useState } from "react";

/**
 * Daily traffic, drawn so it can actually be read.
 *
 * The previous version was a row of bare bars: no axes, no scale, and a native
 * `title` attribute for the count — which takes a second to appear, cannot be
 * triggered by touch at all, and told you nothing about magnitude in between.
 * A 90-day range on a phone made every bar about four pixels wide, so there was
 * no way to hit the one you wanted.
 *
 * This keeps the y-axis pinned outside a horizontally scrollable plot, so days
 * stay a usable width on a narrow screen without the page itself ever
 * overflowing sideways.
 */

export type TrafficPoint = { day: string; views: number };

/** Bar slot width. Enough to hit with a thumb, and to scroll rather than shrink. */
const MIN_SLOT_PX = 14;
const PLOT_HEIGHT = "h-44 sm:h-56";

function formatDay(day: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
}

/**
 * A rounded ceiling for the axis, so the top gridline reads 40 rather than 37.
 * Falls back to 1 for an all-zero range, which keeps every bar flat on the
 * baseline instead of dividing by zero.
 */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  if (value <= 5) return value;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
}

/** Evenly spaced label positions, including both ends, without crowding. */
function tickIndexes(length: number, desired: number): number[] {
  if (length <= 1) return length === 1 ? [0] : [];
  const count = Math.max(2, Math.min(desired, length));
  const step = (length - 1) / (count - 1);
  return Array.from({ length: count }, (_, index) => Math.round(index * step)).filter(
    (value, index, all) => all.indexOf(value) === index,
  );
}

export default function PortfolioTrafficChart({
  points,
  totalViews,
}: {
  points: TrafficPoint[];
  totalViews: number;
}) {
  const [active, setActive] = useState<number | null>(null);

  const max = useMemo(() => niceCeiling(Math.max(...points.map((point) => point.views), 0)), [points]);
  const ticks = useMemo(() => tickIndexes(points.length, points.length > 45 ? 4 : 5), [points]);
  const peak = useMemo(
    () => points.reduce<TrafficPoint | null>((best, point) => (!best || point.views > best.views ? point : best), null),
    [points],
  );

  if (points.length === 0) return null;

  const activePoint = active === null ? null : points[active];
  const summary = `Daily views from ${formatDay(points[0].day)} to ${formatDay(points[points.length - 1].day)}. ${totalViews} views in total${
    peak && peak.views > 0 ? `, peaking at ${peak.views} on ${formatDay(peak.day)}` : ""
  }.`;

  return (
    <figure className="m-0">
      <div className="flex gap-2 sm:gap-3">
        {/* Axis sits outside the scroller so the scale stays visible while panning. */}
        <div className={`relative ${PLOT_HEIGHT} w-7 shrink-0 sm:w-9`} aria-hidden="true">
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

        <div className="min-w-0 flex-1">
          <div className="overflow-x-auto pb-1">
            <div style={{ minWidth: `${points.length * MIN_SLOT_PX}px` }}>
              <div
                className={`relative ${PLOT_HEIGHT}`}
                role="img"
                aria-label={summary}
                onPointerLeave={() => setActive(null)}
              >
                {/* Gridlines read as the scale; the baseline is solid. */}
                {[1, 0.5, 0].map((fraction) => (
                  <span
                    key={fraction}
                    aria-hidden="true"
                    className={`absolute inset-x-0 border-t ${fraction === 0 ? "border-border" : "border-border/50 border-dashed"}`}
                    style={{ top: `${(1 - fraction) * 100}%` }}
                  />
                ))}

                <div className="absolute inset-0 flex items-end gap-px">
                  {points.map((point, index) => {
                    const isActive = active === index;
                    return (
                      <div
                        key={point.day}
                        data-traffic-bar={point.day}
                        className="group relative flex h-full flex-1 cursor-default items-end"
                        onPointerEnter={() => setActive(index)}
                        onClick={() => setActive(index)}
                      >
                        {/* Full-height hit area: thin bars stay easy to target. */}
                        <span className="absolute inset-0" aria-hidden="true" />
                        <span
                          className={`w-full rounded-t-[3px] transition-colors ${isActive ? "bg-primary" : "bg-primary/60"}`}
                          style={{
                            height: point.views > 0 ? `${Math.max((point.views / max) * 100, 3)}%` : "2px",
                            // A zero day still shows a hairline, so gaps in the
                            // series read as "no views" rather than "no data".
                            opacity: point.views > 0 ? 1 : 0.35,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {activePoint && (
                  <div
                    data-traffic-tooltip
                    className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-semibold text-background shadow-lg"
                    style={{
                      left: `${((active! + 0.5) / points.length) * 100}%`,
                      // Keeps the pill inside the plot at either extreme.
                      transform: `translate(${active! < points.length * 0.06 ? "0" : active! > points.length * 0.94 ? "-100%" : "-50%"}, -100%)`,
                    }}
                  >
                    <span className="block tabular-nums">
                      {activePoint.views} view{activePoint.views === 1 ? "" : "s"}
                    </span>
                    <span className="block font-medium opacity-70">
                      {formatDay(activePoint.day, { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </div>
                )}
              </div>

              <div className="relative mt-2 h-4">
                {ticks.map((index) => (
                  <span
                    key={index}
                    className="absolute text-[10px] text-muted-foreground"
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

          <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
            <span>Date</span>
            {points.length * MIN_SLOT_PX > 360 && <span className="sm:hidden">Scroll to see every day →</span>}
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

      <p className="sr-only" aria-live="polite">
        {activePoint ? `${formatDay(activePoint.day)}: ${activePoint.views} views` : ""}
      </p>
    </figure>
  );
}
