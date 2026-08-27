"use client";

import * as m from "motion/react-m";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductFrame } from "@/components/marketing/product/ProductFrame";

export type ProductCalendarProps = {
  month: string;
  days: string[];
  events: { day: number; start: number; span: number; label: string; tone: "blue" | "violet" | "emerald" }[];
};

const tones = { blue: "border-blue-200 bg-blue-50 text-blue-800", violet: "border-violet-200 bg-violet-50 text-violet-800", emerald: "border-emerald-200 bg-emerald-50 text-emerald-800" };

export function ProductCalendar({ month, days, events }: ProductCalendarProps) {
  return (
    <ProductFrame title="Your work, on one timeline" eyebrow="Calendar" toolbar={<span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[0.55rem] font-bold"><ChevronLeft className="h-3 w-3" />{month}<ChevronRight className="h-3 w-3" /></span>}>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50">
          {days.map((day, index) => <div key={day} className={`px-2 py-2 text-center font-mono text-[0.48rem] font-bold uppercase tracking-[0.08em] ${index ? "border-l border-slate-200" : ""} ${index === 2 ? "text-blue-700" : "text-slate-600"}`}>{day}</div>)}
        </div>
        <div className="relative grid h-64 grid-cols-5">
          {days.map((day, dayIndex) => (
            <div key={day} className={`relative ${dayIndex ? "border-l border-slate-200" : ""}`}>
              {Array.from({ length: 8 }, (_, index) => (
                <span
                  key={index}
                  className="absolute inset-x-0 border-t border-dashed border-slate-100"
                  style={{ top: `${index * 12.5}%` }}
                />
              ))}
            </div>
          ))}
          {events.map((event, index) => (
            <m.div key={event.label} className={`absolute z-10 overflow-hidden truncate whitespace-nowrap rounded-md border px-2 py-1 text-[0.5rem] font-bold shadow-sm ${tones[event.tone]}`} style={{ left: `calc(${event.day * 20}% + 4px)`, width: "calc(20% - 8px)", top: `${event.start * 12.5 + 1}%`, height: `${event.span * 12.5 - 2}%` }} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.18 + index * 0.16 }}>
              <CalendarDays className="mb-1 h-2.5 w-2.5" />{event.label}
            </m.div>
          ))}
          <m.div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" initial={{ top: "24%" }} animate={{ top: "46%" }} transition={{ duration: 1.4, ease: [0.23, 1, 0.32, 1] }}><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /><span className="h-px flex-1 bg-rose-400" /></m.div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[0.55rem] text-blue-800"><span className="font-bold">Apple Calendar feed</span><span className="rounded-full bg-white px-2 py-1 font-mono text-[0.45rem] font-bold uppercase tracking-[0.1em]">Subscribed</span></div>
    </ProductFrame>
  );
}
