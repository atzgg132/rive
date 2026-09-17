/**
 * Pure calendar-time helpers shared by server routes and client components.
 * No server-only imports — this module must stay safe to import from
 * "use client" code (no prisma, no node: modules beyond what bundlers shim).
 *
 * The whole module exists because an event's wall clock and its instant are
 * different things: the user picks "15:00" in a named zone, we store the
 * instant, and Google needs the naive wall time + IANA zone back again.
 */

const TIME_ZONE_ALIASES: ReadonlyMap<string, string> = new Map([
  ["asia/calcutta", "Asia/Kolkata"],
]);

export function canonicalTimeZone(value: string): string | null {
  const candidate = TIME_ZONE_ALIASES.get(value.trim().toLowerCase()) ?? value.trim();
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return null;
  }
}

export function isValidTimeZone(value: string): boolean {
  return canonicalTimeZone(value) !== null;
}

export function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Date-string math ("2026-09-12" + 1 → "2026-09-13"), always in UTC day space. */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function zoneParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const lookup = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour"),
    minute: lookup("minute"),
    second: lookup("second"),
  };
}

/** How far `timeZone` is ahead of UTC at `instant`, in milliseconds. */
function zoneOffsetMs(timeZone: string, instant: Date): number {
  const parts = zoneParts(instant, timeZone);
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  // The parts are second-precision; floor the instant to match so sub-second
  // drift doesn't leak into the offset.
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Interpret "YYYY-MM-DD" + "HH:mm" as wall time in `timeZone` and return the
 * instant. Two passes over the zone offset handle the DST boundary: the offset
 * in effect at the naive guess can differ from the offset at the real instant.
 * During the fall-back overlap the first occurrence wins; during the spring
 * gap the wall time shifts forward — both match how calendar UIs behave.
 */
export function wallToInstant(date: string, time: string, timeZone: string): Date | null {
  const zone = canonicalTimeZone(timeZone);
  if (!isDateOnly(date) || !/^\d{2}:\d{2}$/.test(time) || !zone) return null;
  const guess = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const firstOffset = zoneOffsetMs(zone, guess);
  let instant = new Date(guess.getTime() - firstOffset);
  const secondOffset = zoneOffsetMs(zone, instant);
  if (secondOffset !== firstOffset) instant = new Date(guess.getTime() - secondOffset);
  return instant;
}

/** The wall date and "HH:mm" an instant shows in `timeZone`. */
export function instantToWallParts(
  instant: Date | string,
  timeZone: string,
): { date: string; time: string } | null {
  const value = typeof instant === "string" ? new Date(instant) : instant;
  const zone = canonicalTimeZone(timeZone);
  if (Number.isNaN(value.getTime()) || !zone) return null;
  const parts = zoneParts(value, zone);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * "2026-09-12T15:30:00" — the offset-free local form Google Calendar expects
 * next to an explicit `timeZone` field. Never carries a Z or ±offset.
 */
export function localDateTimeInZone(instant: Date | string, timeZone: string): string | null {
  const value = typeof instant === "string" ? new Date(instant) : instant;
  const zone = canonicalTimeZone(timeZone);
  if (Number.isNaN(value.getTime()) || !zone) return null;
  const parts = zoneParts(value, zone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

/** IANA zones for the picker, with a curated fallback for older engines. */
export function supportedTimeZones(): string[] {
  try {
    const list = Intl.supportedValuesOf("timeZone");
    if (Array.isArray(list) && list.length) {
      return [...new Set(list.map((zone) => canonicalTimeZone(zone) ?? zone))];
    }
  } catch {}
  return [
    "UTC",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Europe/London",
    "Europe/Berlin",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Australia/Sydney",
  ];
}
