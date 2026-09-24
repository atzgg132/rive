import assert from "node:assert/strict";
import test from "node:test";
import {
  activeReliabilityCaveats,
  createSharedLoader,
  formatHours,
  hoursToFirstEngagement,
  trailingTrend,
} from "../../src/lib/analytics/adminMetricsMath.ts";

const at = (iso) => new Date(iso);

test("time to engagement uses each account's first flow and ignores pre-instrumentation signups", () => {
  const since = at("2026-09-01T00:00:00Z");
  const users = [
    { id: "legacy", createdAt: at("2026-07-15T00:00:00Z") },
    { id: "repeat", createdAt: at("2026-09-02T00:00:00Z") },
    { id: "quick", createdAt: at("2026-09-03T00:00:00Z") },
  ];
  const events = [
    // 49 days after signup — the value that produced a 1179h P75 in production.
    { userId: "legacy", occurredAt: at("2026-09-02T01:00:00Z") },
    { userId: "repeat", occurredAt: at("2026-09-02T10:00:00Z") },
    { userId: "repeat", occurredAt: at("2026-09-02T02:00:00Z") },
    { userId: "repeat", occurredAt: at("2026-09-20T00:00:00Z") },
    { userId: "quick", occurredAt: at("2026-09-03T00:30:00Z") },
    { userId: null, occurredAt: at("2026-09-03T00:30:00Z") },
  ];
  const hours = hoursToFirstEngagement(users, events, since).sort((a, b) => a - b);
  assert.deepEqual(hours, [0.5, 2]);
});

test("time to engagement is empty before instrumentation exists", () => {
  assert.deepEqual(hoursToFirstEngagement([{ id: "a", createdAt: at("2026-09-02T00:00:00Z") }], [{ userId: "a", occurredAt: at("2026-09-02T01:00:00Z") }], null), []);
});

test("a zero prior week is reported as zero, not as missing", () => {
  const daily = Array.from({ length: 14 }, (_, index) => ({ day: String(index), count: index === 13 ? 1 : 0 }));
  assert.deepEqual(trailingTrend(daily), { current: 1, previous: 0, change: null });
  const growing = Array.from({ length: 14 }, (_, index) => ({ day: String(index), count: index < 7 ? 1 : 2 }));
  assert.deepEqual(trailingTrend(growing), { current: 14, previous: 7, change: 100 });
});

test("reliability caveats appear only when their condition holds", () => {
  const healthy = { alertIds: [], contractRejections24h: 0, uncapturedSignupRate: 0, failedEmails24h: 0 };
  assert.deepEqual(activeReliabilityCaveats(healthy), []);
  assert.deepEqual(activeReliabilityCaveats({ ...healthy, uncapturedSignupRate: 5 }), []);
  assert.deepEqual(
    activeReliabilityCaveats({ alertIds: ["event_lag_minutes", "event_scan_truncated"], contractRejections24h: 2, uncapturedSignupRate: 35.1, failedEmails24h: 1 }),
    ["stale_events", "contract_rejects", "event_scan_truncated", "uncaptured_source", "email_failures"],
  );
});

test("concurrent cold reads share one load, and the result is cached for the TTL", async () => {
  let clock = 0;
  let loads = 0;
  let release;
  const loader = createSharedLoader(30_000, () => { loads += 1; return new Promise((resolve) => { release = resolve; }); }, () => clock);
  const first = loader.get();
  const second = loader.get();
  release("snapshot");
  assert.deepEqual(await Promise.all([first, second]), ["snapshot", "snapshot"]);
  assert.equal(loads, 1);

  clock = 29_999;
  assert.equal(await loader.get(), "snapshot");
  assert.equal(loads, 1);

  clock = 30_001;
  const refreshed = loader.get();
  release("next");
  assert.equal(await refreshed, "next");
  assert.equal(loads, 2);
});

test("a failed load is not cached and the next read retries", async () => {
  let loads = 0;
  const loader = createSharedLoader(30_000, async () => { loads += 1; if (loads === 1) throw new Error("timeout"); return "ok"; });
  await assert.rejects(loader.get(), /timeout/);
  assert.equal(await loader.get(), "ok");
  assert.equal(loads, 2);
});

test("clear() during a load keeps the stale result out of the cache", async () => {
  let loads = 0;
  let release;
  const loader = createSharedLoader(30_000, () => { loads += 1; return new Promise((resolve) => { release = resolve; }); });
  const pending = loader.get();
  loader.clear();
  release("before-change");
  assert.equal(await pending, "before-change");
  assert.equal(loader.peek(), null);
  const after = loader.get();
  release("after-change");
  assert.equal(await after, "after-change");
  assert.equal(loads, 2);
});

test("engagement durations read in the unit a person would use", () => {
  assert.equal(formatHours(0), "under 1m");
  assert.equal(formatHours(0.01), "under 1m");
  assert.equal(formatHours(0.05), "3m");
  assert.equal(formatHours(0.999), "1h");
  assert.equal(formatHours(0.5), "30m");
  assert.equal(formatHours(1), "1h");
  assert.equal(formatHours(3.46), "3.5h");
  assert.equal(formatHours(47.9), "47.9h");
  assert.equal(formatHours(50), "2.1d");
});
