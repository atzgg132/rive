import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFunnelQuality } from "../../src/lib/analytics/funnelQuality.ts";

const healthy = {
  signups: { total: 20, last24h: 1, last7d: 8 },
  reliability: { productEvents24h: 30, failedEmails24h: 0, queuedEmails: 0 },
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
    quality: { ...healthy.quality, missingDataOriginEvents24h: 1, unknownOriginRecords: 3, eventLagMinutes: 31, uncapturedSignupRate: 8, uncapturedSignups: 4 },
  });
  assert.equal(alerts.every((item) => item.severity === "warning"), true);
  assert.deepEqual(new Set(alerts.map((item) => item.id)), new Set(["missing_data_origin_events_24h", "unknown_origin_records", "event_lag_minutes", "uncaptured_signup_source", "failed_emails_24h", "queued_email_backlog"]));
});

test("large email backlog escalates to critical", () => {
  const alerts = evaluateFunnelQuality({
    ...healthy,
    reliability: { ...healthy.reliability, queuedEmails: 250 },
  });
  assert.equal(alerts.find((item) => item.id === "queued_email_backlog")?.severity, "critical");
});
