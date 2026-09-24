import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFunnelQuality } from "../../src/lib/analytics/funnelQuality.ts";

const healthy = {
  signups: { total: 20, last24h: 1, last7d: 8 },
  reliability: { productEvents24h: 30, productEvents7d: 120, failedEmails24h: 0, queuedEmails: 0 },
  quality: {
    contractRejections24h: 0,
    unknownEventNames24h: 0,
    missingIdentityEvents24h: 0,
    missingDataOriginEvents24h: 0,
    unknownOriginRecords: 0,
    latestEventAt: new Date().toISOString(),
    eventLagMinutes: 3,
    uncapturedSignups: 0,
    uncapturedSignupRate: 0,
  },
};

test("funnel quality stays quiet when all operational signals are healthy", () => {
  assert.deepEqual(evaluateFunnelQuality(healthy), []);
});

test("contract failures and missing event stream are critical", () => {
  const alerts = evaluateFunnelQuality({
    ...healthy,
    reliability: { ...healthy.reliability, productEvents24h: 0 },
    quality: { ...healthy.quality, contractRejections24h: 2 },
  });
  assert.equal(alerts.some((item) => item.id === "contract_rejections_24h" && item.severity === "critical"), true);
  assert.equal(alerts.some((item) => item.id === "no_product_events_after_signups" && item.severity === "critical"), true);
});

test("data quality and email backlog produce actionable warnings", () => {
  const alerts = evaluateFunnelQuality({
    ...healthy,
    reliability: { ...healthy.reliability, failedEmails24h: 1, queuedEmails: 50 },
    quality: { ...healthy.quality, missingDataOriginEvents24h: 1, unknownOriginRecords: 3, eventLagMinutes: 1441, uncapturedSignupRate: 8, uncapturedSignups: 4 },
  });
  assert.equal(alerts.every((item) => item.severity === "warning"), true);
  assert.deepEqual(new Set(alerts.map((item) => item.id)), new Set(["missing_data_origin_events_24h", "unknown_origin_records", "event_lag_minutes", "uncaptured_signup_source", "failed_emails_24h", "queued_email_backlog"]));
});

test("a truncated event scan is flagged instead of silently undercounting", () => {
  const alerts = evaluateFunnelQuality({
    ...healthy,
    coverage: { eventScan: { scanned: 200_000, total: 260_500 } },
  });
  const truncated = alerts.find((item) => item.id === "event_scan_truncated");
  assert.equal(truncated?.severity, "warning");
  assert.equal(truncated?.actual, 60_500);

  const full = evaluateFunnelQuality({
    ...healthy,
    coverage: { eventScan: { scanned: 150, total: 150 } },
  });
  assert.equal(full.some((item) => item.id === "event_scan_truncated"), false);
});

test("large email backlog escalates to critical", () => {
  const alerts = evaluateFunnelQuality({
    ...healthy,
    reliability: { ...healthy.reliability, queuedEmails: 250 },
  });
  assert.equal(alerts.find((item) => item.id === "queued_email_backlog")?.severity, "critical");
});

test("a quiet day at low volume is not a stale stream", () => {
  // Production on 2026-09-24: 1 weekly active user, last event ~6.6h old.
  const alerts = evaluateFunnelQuality({
    ...healthy,
    signups: { total: 37, last24h: 0, last7d: 1 },
    reliability: { ...healthy.reliability, productEvents24h: 82, productEvents7d: 300 },
    quality: { ...healthy.quality, eventLagMinutes: 399.7 },
  });
  assert.equal(alerts.some((item) => item.id === "event_lag_minutes"), false);
});

test("a day without events after an active week is flagged as stale", () => {
  const alerts = evaluateFunnelQuality({
    ...healthy,
    signups: { total: 37, last24h: 0, last7d: 0 },
    reliability: { ...healthy.reliability, productEvents24h: 0, productEvents7d: 40 },
    quality: { ...healthy.quality, eventLagMinutes: 1500 },
  });
  const stale = alerts.find((item) => item.id === "event_lag_minutes");
  assert.equal(stale?.severity, "warning");
  assert.match(stale?.detail || "", /25 hours/);
});

test("a stream silent for over a week only alerts when new signups arrive", () => {
  const silent = {
    ...healthy,
    signups: { total: 37, last24h: 0, last7d: 0 },
    reliability: { ...healthy.reliability, productEvents24h: 0, productEvents7d: 0 },
    quality: { ...healthy.quality, eventLagMinutes: 12_000 },
  };
  assert.equal(evaluateFunnelQuality(silent).some((item) => item.id === "event_lag_minutes"), false);
  const withSignups = { ...silent, signups: { total: 38, last24h: 0, last7d: 1 } };
  assert.equal(evaluateFunnelQuality(withSignups).some((item) => item.id === "event_lag_minutes"), true);
});
