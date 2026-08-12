/**
 * Date normalization.
 *
 * Two rules drive everything here:
 *
 * 1. A date-only field must never move. Invoice dates, due dates and expense
 *    dates are calendar facts, not instants, so they are anchored to UTC
 *    midnight and only ever read back in UTC. Parsing via `new Date("3/4/2026")`
 *    would apply the server's locale and timezone and can shift the day.
 * 2. Genuinely ambiguous input is reported, not resolved. `03/04/2026` is
 *    3 April in most of the world and 4 March in the US. The engine records
 *    both readings and asks rather than picking one.
 */

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export type DateFormatLabel = "ISO" | "DMY" | "MDY" | "TEXTUAL" | "YMD" | "TIMESTAMP";

export type DateParse = {
  /** Calendar date as `YYYY-MM-DD`. The value the user sees. */
  iso: string;
  /** UTC-midnight instant for date-only values; exact instant for timestamps. */
  date: Date;
  format: DateFormatLabel;
  /** True when the same digits support a second, different calendar date. */
  ambiguous: boolean;
  /** The rejected reading, so the UI can offer it as the alternative. */
  alternative: string | null;
  hasTime: boolean;
};

/** Interpretation order for all-numeric dates when the source gives no hint. */
export type DayFirstPreference = "auto" | "dmy" | "mdy";

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Expand a two-digit year. Business exports are overwhelmingly recent, so the
 * common 1970-2069 sliding window is used rather than assuming 19xx.
 */
function expandYear(value: number): number {
  if (value >= 100) return value;
  return value >= 70 ? 1900 + value : 2000 + value;
}

/**
 * Parse a date value.
 *
 * `preference` only breaks ties for all-numeric input where both readings are
 * valid; it never overrides an unambiguous date such as `13/04/2026`.
 */
export function parseDateValue(input: string, preference: DayFirstPreference = "auto"): DateParse | null {
  const value = input.trim();
  if (!value) return null;

  // ISO 8601, with or without a time component.
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidCalendarDate(year, month, day)) return null;
    const hasTime = isoMatch[4] !== undefined;
    return {
      iso: toIso(year, month, day),
      date: new Date(
        Date.UTC(year, month - 1, day, Number(isoMatch[4] || 0), Number(isoMatch[5] || 0), Number(isoMatch[6] || 0)),
      ),
      format: hasTime ? "TIMESTAMP" : "ISO",
      ambiguous: false,
      alternative: null,
      hasTime,
    };
  }

  // Textual months: "3 Apr 2026", "April 3, 2026", "Apr 3 2026".
  const textual = parseTextualDate(value);
  if (textual) return textual;

  // All-numeric with separators: 03/04/2026, 3-4-26, 03.04.2026.
  const numeric = value.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const third = Number(numeric[3]);
    const hasTime = numeric[4] !== undefined;
    const time = {
      hours: Number(numeric[4] || 0),
      minutes: Number(numeric[5] || 0),
      seconds: Number(numeric[6] || 0),
    };

    // A four-digit leading group can only be the year.
    if (numeric[1].length === 4) {
      if (!isValidCalendarDate(first, second, third)) return null;
      return build(first, second, third, "YMD", false, null, hasTime, time);
    }

    const year = expandYear(third);
    const dmyValid = isValidCalendarDate(year, second, first);
    const mdyValid = isValidCalendarDate(year, first, second);

    if (dmyValid && mdyValid && first !== second) {
      // Both readings work and disagree — this is the case worth surfacing.
      if (preference === "dmy") {
        return build(year, second, first, "DMY", true, toIso(year, first, second), hasTime, time);
      }
      if (preference === "mdy") {
        return build(year, first, second, "MDY", true, toIso(year, second, first), hasTime, time);
      }
      return build(year, second, first, "DMY", true, toIso(year, first, second), hasTime, time);
    }
    if (dmyValid) return build(year, second, first, "DMY", false, null, hasTime, time);
    if (mdyValid) return build(year, first, second, "MDY", false, null, hasTime, time);
    return null;
  }

  return null;
}

function build(
  year: number,
  month: number,
  day: number,
  format: DateFormatLabel,
  ambiguous: boolean,
  alternative: string | null,
  hasTime: boolean,
  time: { hours: number; minutes: number; seconds: number },
): DateParse {
  return {
    iso: toIso(year, month, day),
    date: new Date(Date.UTC(year, month - 1, day, time.hours, time.minutes, time.seconds)),
    format: hasTime ? "TIMESTAMP" : format,
    ambiguous,
    alternative,
    hasTime,
  };
}

function parseTextualDate(value: string): DateParse | null {
  const cleaned = value.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  // "3 Apr 2026" / "3rd April 2026"
  const dayFirst = cleaned.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})$/);
  if (dayFirst) {
    const month = MONTH_NAMES[dayFirst[2].toLowerCase()];
    const day = Number(dayFirst[1]);
    const year = expandYear(Number(dayFirst[3]));
    if (month && isValidCalendarDate(year, month, day)) {
      return build(year, month, day, "TEXTUAL", false, null, false, { hours: 0, minutes: 0, seconds: 0 });
    }
  }
  // "April 3 2026" / "Apr 3rd 2026"
  const monthFirst = cleaned.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{2,4})$/);
  if (monthFirst) {
    const month = MONTH_NAMES[monthFirst[1].toLowerCase()];
    const day = Number(monthFirst[2]);
    const year = expandYear(Number(monthFirst[3]));
    if (month && isValidCalendarDate(year, month, day)) {
      return build(year, month, day, "TEXTUAL", false, null, false, { hours: 0, minutes: 0, seconds: 0 });
    }
  }
  return null;
}

/** Cheap check used by the profiler; avoids allocating a full parse result. */
export function isDateLike(value: string): boolean {
  return parseDateValue(value) !== null;
}

/**
 * Decide a whole column's date interpretation from its values.
 *
 * One unambiguous row (a day above 12) settles the format for every ambiguous
 * row beside it. This is the single most effective way to avoid asking the user
 * about dates, and it is evidence-based rather than locale guesswork.
 */
export function inferColumnDatePreference(values: readonly string[]): {
  preference: DayFirstPreference;
  evidence: string | null;
} {
  let dmyOnly = 0;
  let mdyOnly = 0;
  for (const value of values) {
    const match = value.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
    if (!match) continue;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12 && second <= 12) dmyOnly += 1;
    else if (second > 12 && first <= 12) mdyOnly += 1;
  }
  if (dmyOnly > 0 && mdyOnly === 0) {
    return { preference: "dmy", evidence: `${dmyOnly} value(s) have a day above 12` };
  }
  if (mdyOnly > 0 && dmyOnly === 0) {
    return { preference: "mdy", evidence: `${mdyOnly} value(s) have a month above 12` };
  }
  return { preference: "auto", evidence: null };
}

/** Format a stored UTC-midnight date back to `YYYY-MM-DD` without shifting. */
export function toDateOnlyString(date: Date): string {
  return toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}
