import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWeeklySummaryContent,
  isMondayMorningWindow,
  isoWeekKey,
  selectDueForWeeklySummary,
  shouldSendWeeklySummary,
} from "../../src/utils/weeklySummary.ts";

// 2026-09-28 is a Monday; America/New_York is on EDT (UTC-4) that week.
const MONDAY_0800_EDT = new Date("2026-09-28T12:00:00.000Z");
const MONDAY_0859_EDT = new Date("2026-09-28T12:59:00.000Z");
const MONDAY_0900_EDT = new Date("2026-09-28T13:00:00.000Z");
const MONDAY_0759_EDT = new Date("2026-09-28T11:59:00.000Z");
const SUNDAY_0800_EDT = new Date("2026-09-27T12:00:00.000Z");
const TUESDAY_0800_EDT = new Date("2026-09-29T12:00:00.000Z");

// 2026-11-30 is a Monday after the US DST fall-back (2026-11-01), so
// America/New_York is on EST (UTC-5) that week.
const MONDAY_0800_EST = new Date("2026-11-30T13:00:00.000Z");

test("Monday 08:00-08:59 local window, minute-precise at both edges", () => {
  assert.equal(isMondayMorningWindow(MONDAY_0800_EDT, "America/New_York"), true);
  assert.equal(isMondayMorningWindow(MONDAY_0859_EDT, "America/New_York"), true);
  assert.equal(isMondayMorningWindow(MONDAY_0759_EDT, "America/New_York"), false, "one minute before the window");
  assert.equal(isMondayMorningWindow(MONDAY_0900_EDT, "America/New_York"), false, "one minute after the window");
});

test("window excludes every other day of the week", () => {
  assert.equal(isMondayMorningWindow(SUNDAY_0800_EDT, "America/New_York"), false);
  assert.equal(isMondayMorningWindow(TUESDAY_0800_EDT, "America/New_York"), false);
});

test("window holds across the DST boundary (EDT and EST both resolve 08:00 local)", () => {
  assert.equal(isMondayMorningWindow(MONDAY_0800_EDT, "America/New_York"), true, "EDT Monday");
  assert.equal(isMondayMorningWindow(MONDAY_0800_EST, "America/New_York"), true, "EST Monday");
  // The same UTC instant is a different local hour in each zone, so it is
  // only ever "the window" for the zone whose 08:00 it actually is.
  assert.equal(isMondayMorningWindow(MONDAY_0800_EDT, "UTC"), false);
});

test("time zones on opposite sides of the date line select different calendar Mondays", () => {
  // 2026-09-28T12:00:00Z is Monday 21:00 in Asia/Tokyo (UTC+9) — past its window —
  // and Monday 05:00 in America/Los_Angeles (UTC-7) — also outside 08:00-08:59.
  assert.equal(isMondayMorningWindow(MONDAY_0800_EDT, "Asia/Tokyo"), false);
  assert.equal(isMondayMorningWindow(MONDAY_0800_EDT, "America/Los_Angeles"), false);
  // Shift three hours later: 15:00Z is 08:00 in America/Los_Angeles.
  assert.equal(isMondayMorningWindow(new Date("2026-09-28T15:00:00.000Z"), "America/Los_Angeles"), true);
});

test("falls back to UTC for an unrecognized time zone instead of throwing", () => {
  assert.equal(isMondayMorningWindow(MONDAY_0800_EDT, "Not/AZone"), isMondayMorningWindow(MONDAY_0800_EDT, "UTC"));
});

test("isoWeekKey is stable across a calendar week and changes at the boundary", () => {
  const mondayKey = isoWeekKey(MONDAY_0800_EDT, "America/New_York");
  const sameWeekLater = isoWeekKey(new Date("2026-10-01T12:00:00.000Z"), "America/New_York"); // Thursday
  const nextMonday = isoWeekKey(new Date("2026-10-05T12:00:00.000Z"), "America/New_York");
  assert.equal(mondayKey, sameWeekLater);
  assert.notEqual(mondayKey, nextMonday);
});

test("shouldSendWeeklySummary: opted out never sends, regardless of timing", () => {
  assert.equal(
    shouldSendWeeklySummary(
      { weeklySummaryEnabled: false, timeZone: "America/New_York", weeklySummaryLastSentAt: null },
      MONDAY_0800_EDT,
    ),
    false,
  );
});

test("shouldSendWeeklySummary: opted in, in-window, never sent before -> sends", () => {
  assert.equal(
    shouldSendWeeklySummary(
      { weeklySummaryEnabled: true, timeZone: "America/New_York", weeklySummaryLastSentAt: null },
      MONDAY_0800_EDT,
    ),
    true,
  );
});

test("shouldSendWeeklySummary: already sent this ISO week -> does not send again", () => {
  const sentEarlierThisMorning = new Date("2026-09-28T12:05:00.000Z");
  assert.equal(
    shouldSendWeeklySummary(
      { weeklySummaryEnabled: true, timeZone: "America/New_York", weeklySummaryLastSentAt: sentEarlierThisMorning },
      MONDAY_0859_EDT,
    ),
    false,
  );
});

test("shouldSendWeeklySummary: sent last ISO week -> sends again this week", () => {
  const sentLastMonday = new Date("2026-09-21T12:00:00.000Z");
  assert.equal(
    shouldSendWeeklySummary(
      { weeklySummaryEnabled: true, timeZone: "America/New_York", weeklySummaryLastSentAt: sentLastMonday },
      MONDAY_0800_EDT,
    ),
    true,
  );
});

test("shouldSendWeeklySummary: opted in but outside the Monday morning window -> does not send", () => {
  assert.equal(
    shouldSendWeeklySummary(
      { weeklySummaryEnabled: true, timeZone: "America/New_York", weeklySummaryLastSentAt: null },
      TUESDAY_0800_EDT,
    ),
    false,
  );
});

test("selectDueForWeeklySummary: tenant isolation — one user's send state never affects another's", () => {
  const userA = { id: "a", weeklySummaryEnabled: true, timeZone: "America/New_York", weeklySummaryLastSentAt: MONDAY_0800_EDT };
  const userB = { id: "b", weeklySummaryEnabled: true, timeZone: "America/New_York", weeklySummaryLastSentAt: null };
  const userC = { id: "c", weeklySummaryEnabled: false, timeZone: "America/New_York", weeklySummaryLastSentAt: null };
  const due = selectDueForWeeklySummary([userA, userB, userC], MONDAY_0859_EDT);
  assert.deepEqual(due.map((u) => u.id), ["b"]);
});

test("selectDueForWeeklySummary: distinct time zones each judged on their own local clock", () => {
  const nyUser = { id: "ny", weeklySummaryEnabled: true, timeZone: "America/New_York", weeklySummaryLastSentAt: null };
  const tokyoUser = { id: "tokyo", weeklySummaryEnabled: true, timeZone: "Asia/Tokyo", weeklySummaryLastSentAt: null };
  const due = selectDueForWeeklySummary([nyUser, tokyoUser], MONDAY_0800_EDT);
  assert.deepEqual(due.map((u) => u.id), ["ny"]);
});

test("buildWeeklySummaryContent: skips sending when every section is empty", () => {
  const content = buildWeeklySummaryContent({
    currency: "USD",
    paidLastWeek: 0,
    outstanding: 0,
    overdue: 0,
    deadlines: [],
    meetings: [],
    agreementsAwaitingClient: [],
  });
  assert.equal(content, null);
});

test("buildWeeklySummaryContent: skips when agreements are unavailable and unrelated sections are empty", () => {
  const content = buildWeeklySummaryContent({
    currency: "USD",
    paidLastWeek: 0,
    outstanding: 0,
    overdue: 0,
    deadlines: [],
    meetings: [],
    agreementsAwaitingClient: null,
  });
  assert.equal(content, null);
});

test("buildWeeklySummaryContent: an overdue balance alone is content, even with zero paid", () => {
  const content = buildWeeklySummaryContent({
    currency: "USD",
    paidLastWeek: 0,
    outstanding: 0,
    overdue: 450,
    deadlines: [],
    meetings: [],
    agreementsAwaitingClient: null,
  });
  assert.ok(content);
  assert.equal(content.overdue, 450);
});

test("buildWeeklySummaryContent: carries totals, deadlines, meetings and agreements through untouched", () => {
  const deadlines = [{ id: "p1", title: "Website redesign", dueDate: new Date("2026-10-02") }];
  const meetings = [{ id: "m1", title: "Kickoff call", startAt: new Date("2026-09-29T15:00:00Z") }];
  const agreementsAwaitingClient = [{ id: "c1", title: "MSA", clientName: "Acme Co" }];
  const content = buildWeeklySummaryContent({
    currency: "EUR",
    paidLastWeek: 1200,
    outstanding: 300,
    overdue: 0,
    deadlines,
    meetings,
    agreementsAwaitingClient,
  });
  assert.ok(content);
  assert.equal(content.currency, "EUR");
  assert.equal(content.paidLastWeek, 1200);
  assert.deepEqual(content.deadlines, deadlines);
  assert.deepEqual(content.meetings, meetings);
  assert.deepEqual(content.agreementsAwaitingClient, agreementsAwaitingClient);
});
