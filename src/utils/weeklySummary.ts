/**
 * Pure scheduling and content rules for the opt-in weekly business summary
 * email (issue #66, PR 5). Kept dependency-free so the Monday-08:00 local
 * selection, once-per-ISO-week gate, and "skip when empty" rule can be tested
 * exhaustively without a database or a mocked Prisma client.
 *
 * DB-touching orchestration (querying users, building content from real
 * records, enqueuing mail) lives in `src/app/api/cron/weekly-summary/route.ts`
 * and calls back into this module for every decision that does not need I/O.
 */

/** Deterministic local-calendar parts for an instant in a given IANA zone. */
export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 1 (Monday) .. 7 (Sunday), ISO-8601 weekday numbering. */
  isoWeekday: number;
};

function localPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
}

const ISO_WEEKDAY_FROM_SHORT: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};

/** Falls back to UTC for an unknown or empty IANA zone name. */
export function normalizeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone || !timeZone.trim()) return "UTC";
  try {
    localPartsFormatter(timeZone).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** The local calendar date, time, and ISO weekday for `instant` in `timeZone`. */
export function localParts(instant: Date, timeZone: string): LocalParts {
  const zone = normalizeTimeZone(timeZone);
  const parts = Object.fromEntries(
    localPartsFormatter(zone).formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    isoWeekday: ISO_WEEKDAY_FROM_SHORT[parts.weekday] ?? 1,
  };
}

/**
 * ISO-8601 week key ("2026-W39") for `instant` in `timeZone`, used to decide
 * "already sent this week" independent of exact send time or DST shifts.
 * Computed from local calendar parts (not the UTC day) so a Monday that is
 * still Sunday in UTC, or vice versa, keys on the recipient's own week.
 */
export function isoWeekKey(instant: Date, timeZone: string): string {
  const { year, month, day } = localParts(instant, timeZone);
  // ISO week algorithm on the local calendar date, done in UTC arithmetic so
  // it is unaffected by the *server's* time zone or DST.
  const date = new Date(Date.UTC(year, month - 1, day));
  const isoWeekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - isoWeekday);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

/** Monday, 08:00-08:59 local time — the one-hour cron window this ships in. */
export function isMondayMorningWindow(instant: Date, timeZone: string): boolean {
  const parts = localParts(instant, timeZone);
  return parts.isoWeekday === 1 && parts.hour === 8;
}

export type WeeklySummaryEligibility = {
  weeklySummaryEnabled: boolean;
  timeZone: string | null | undefined;
  weeklySummaryLastSentAt: Date | null;
};

/**
 * Whether this user is due a summary right now: opted in, it is their Monday
 * 08:00 hour, and no summary has gone out yet for their current ISO week.
 * Pure and per-user, so it never mixes one user's send state into another's
 * decision — the tenant-isolation property the domain tests check directly.
 */
export function shouldSendWeeklySummary(user: WeeklySummaryEligibility, now: Date): boolean {
  if (!user.weeklySummaryEnabled) return false;
  const zone = normalizeTimeZone(user.timeZone);
  if (!isMondayMorningWindow(now, zone)) return false;
  if (!user.weeklySummaryLastSentAt) return true;
  return isoWeekKey(user.weeklySummaryLastSentAt, zone) !== isoWeekKey(now, zone);
}

/** Pure filter over a batch of candidate users — the cron route's selection rule. */
export function selectDueForWeeklySummary<T extends WeeklySummaryEligibility>(users: readonly T[], now: Date): T[] {
  return users.filter((user) => shouldSendWeeklySummary(user, now));
}

export type WeeklySummaryDeadline = { id: string; title: string; dueDate: Date };
export type WeeklySummaryMeeting = { id: string; title: string; startAt: Date };
export type WeeklySummaryAgreement = { id: string; title: string; clientName: string | null };

export type WeeklySummaryInput = {
  currency: string;
  paidLastWeek: number;
  outstanding: number;
  overdue: number;
  deadlines: WeeklySummaryDeadline[];
  meetings: WeeklySummaryMeeting[];
  /** Omitted entirely (not just empty) when the agreements feature is unavailable for this workspace. */
  agreementsAwaitingClient: WeeklySummaryAgreement[] | null;
};

export type WeeklySummaryContent = WeeklySummaryInput & {
  hasContent: true;
};

/**
 * Builds the email's content, or returns `null` when every section is empty —
 * the "skip sending" rule. A zero-amount financial section still counts as
 * empty; a strictly positive `overdue` or `outstanding` counts as content even
 * when `paidLastWeek` is zero, since "nothing came in, but X is overdue" is
 * exactly the kind of thing this email exists to surface.
 */
export function buildWeeklySummaryContent(input: WeeklySummaryInput): WeeklySummaryContent | null {
  const hasFinancials = input.paidLastWeek > 0 || input.outstanding > 0 || input.overdue > 0;
  const hasDeadlines = input.deadlines.length > 0;
  const hasMeetings = input.meetings.length > 0;
  const hasAgreements = Boolean(input.agreementsAwaitingClient?.length);
  if (!hasFinancials && !hasDeadlines && !hasMeetings && !hasAgreements) return null;
  return { ...input, hasContent: true };
}
