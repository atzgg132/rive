/**
 * Wall-clock <-> instant conversion helpers shared by the calendar UI (which
 * renders form fields) and the Google push path (which sends dateTime+timeZone
 * payloads). These run under node --test with no browser and no database.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  addDays,
  canonicalTimeZone,
  instantToWallParts,
  isDateOnly,
  isValidTimeZone,
  localDateTimeInZone,
  supportedTimeZones,
  wallToInstant,
} from "../../src/lib/calendar-time.ts";

import {
  eventToGooglePayload,
  isRevokedGrantResponse,
} from "../../src/utils/googleCalendar.ts";

const KOLKATA = "Asia/Kolkata"; // UTC+5:30, no DST — exercises half-hour offsets
const NEW_YORK = "America/New_York"; // DST rules exercise the offset-search loop

test("wallToInstant interprets a wall time in the named zone, not the browser zone", () => {
  // 15:00 in Kolkata is 09:30 UTC regardless of where the browser runs.
  const instant = wallToInstant("2026-03-10", "15:00", KOLKATA);
  assert.ok(instant);
  assert.equal(instant.toISOString(), "2026-03-10T09:30:00.000Z");
});

test("wallToInstant honors the zone's DST offset in effect on that date", () => {
  // March 10 2026 is EDT (UTC-4): 15:00 local -> 19:00 UTC.
  const summer = wallToInstant("2026-03-10", "15:00", NEW_YORK);
  assert.ok(summer);
  assert.equal(summer.toISOString(), "2026-03-10T19:00:00.000Z");
  // January 10 2026 is EST (UTC-5): same wall time -> 20:00 UTC.
  const winter = wallToInstant("2026-01-10", "15:00", NEW_YORK);
  assert.ok(winter);
  assert.equal(winter.toISOString(), "2026-01-10T20:00:00.000Z");
});

test("wallToInstant survives a nonexistent wall time inside the spring-forward gap", () => {
  // 2026-03-08 02:30 does not exist in New York (clocks jump 02:00 -> 03:00).
  // The helper must still return a finite instant rather than NaN or throw.
  const instant = wallToInstant("2026-03-08", "02:30", NEW_YORK);
  assert.ok(instant);
  assert.ok(Number.isFinite(instant.getTime()));
});

test("instantToWallParts is the exact inverse of wallToInstant", () => {
  const instant = new Date("2026-06-15T18:45:00.000Z");
  const parts = instantToWallParts(instant, KOLKATA);
  assert.ok(parts);
  assert.deepEqual(parts, { date: "2026-06-16", time: "00:15" });
  const roundTrip = wallToInstant(parts.date, parts.time, KOLKATA);
  assert.ok(roundTrip);
  assert.equal(roundTrip.toISOString(), instant.toISOString());
});

test("instantToWallParts lands on the next date across midnight", () => {
  // 20:00 UTC is 01:30 next day in Kolkata — the case behind the IST bug report.
  const parts = instantToWallParts(new Date("2026-03-10T20:00:00.000Z"), KOLKATA);
  assert.ok(parts);
  assert.equal(parts.date, "2026-03-11");
  assert.equal(parts.time, "01:30");
});

test("localDateTimeInZone emits the naive dateTime Google expects (no offset, no Z)", () => {
  const instant = new Date("2026-03-10T09:30:00.000Z");
  assert.equal(localDateTimeInZone(instant, KOLKATA), "2026-03-10T15:00:00");
  assert.equal(localDateTimeInZone(instant, NEW_YORK), "2026-03-10T05:30:00");
});

test("isValidTimeZone accepts IANA names and rejects garbage", () => {
  assert.equal(isValidTimeZone(KOLKATA), true);
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone("Mars/Olympus"), false);
  assert.equal(isValidTimeZone(""), false);
});

test("canonicalTimeZone keeps the deprecated Calcutta alias readable but stores Kolkata", () => {
  assert.equal(canonicalTimeZone("Asia/Calcutta"), KOLKATA);
  assert.equal(canonicalTimeZone(" asia/calcutta "), KOLKATA);
  assert.equal(canonicalTimeZone(KOLKATA), KOLKATA);
  assert.equal(canonicalTimeZone("Mars/Olympus"), null);
  assert.equal(wallToInstant("2026-03-10", "15:00", "Asia/Calcutta")?.toISOString(), "2026-03-10T09:30:00.000Z");
});

test("isDateOnly distinguishes all-day and timed inputs", () => {
  assert.equal(isDateOnly("2026-03-10"), true);
  assert.equal(isDateOnly("2026-03-10T15:00"), false);
  assert.equal(isDateOnly("nope"), false);
});

test("addDays shifts a date-only string across month boundaries", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("supportedTimeZones returns a non-empty IANA list when the runtime supports it", () => {
  const zones = supportedTimeZones();
  assert.ok(zones.length > 100);
  assert.ok(zones.includes("Asia/Kolkata"));
  assert.ok(!zones.includes("Asia/Calcutta"));
});

test("eventToGooglePayload sends naive dateTime + timeZone, letting the zone carry the wall time", () => {
  const event = {
    title: "Client call",
    description: null,
    location: null,
    allDay: false,
    startAt: new Date("2026-03-10T09:30:00.000Z"), // 15:00 in Kolkata
    endAt: new Date("2026-03-10T10:30:00.000Z"),
    startDate: null,
    endDate: null,
    timeZone: KOLKATA,
    availability: "busy",
  };
  const payload = eventToGooglePayload(event);
  assert.deepEqual(payload.start, { dateTime: "2026-03-10T15:00:00", timeZone: KOLKATA });
  assert.deepEqual(payload.end, { dateTime: "2026-03-10T16:00:00", timeZone: KOLKATA });
  assert.equal(payload.transparency, "opaque");
  assert.equal(payload.summary, "Client call");
});

test("eventToGooglePayload marks free events transparent for Google availability", () => {
  const payload = eventToGooglePayload({
    title: "Hold",
    description: null,
    location: null,
    allDay: false,
    startAt: new Date("2026-03-10T09:30:00.000Z"),
    endAt: new Date("2026-03-10T10:30:00.000Z"),
    startDate: null,
    endDate: null,
    timeZone: "UTC",
    availability: "free",
  });
  assert.equal(payload.transparency, "transparent");
});

test("eventToGooglePayload passes all-day dates through (caller stores the exclusive end)", () => {
  const payload = eventToGooglePayload({
    title: "Launch day",
    description: null,
    location: null,
    allDay: true,
    startAt: null,
    endAt: null,
    startDate: "2026-03-10",
    endDate: "2026-03-11", // exclusive, as stored
    timeZone: "UTC",
    availability: "busy",
  });
  assert.deepEqual(payload.start, { date: "2026-03-10" });
  assert.deepEqual(payload.end, { date: "2026-03-11" });
});

test("isRevokedGrantResponse only fires on Google's explicit invalid_grant", () => {
  assert.equal(isRevokedGrantResponse(400, '{"error":"invalid_grant"}'), true);
  assert.equal(isRevokedGrantResponse(400, '{"error":"invalid_client"}'), false);
  assert.equal(isRevokedGrantResponse(401, "Unauthorized"), false);
  assert.equal(isRevokedGrantResponse(403, "insufficient permissions"), false);
  assert.equal(isRevokedGrantResponse(500, '{"error":"invalid_grant"}'), false);
});
