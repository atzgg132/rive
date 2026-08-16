export const FUNNEL_QUALITY_ALERT_VERSION = 1;

export type FunnelQualityAlert = {
  id: string;
  fingerprint: string;
  severity: "warning" | "critical";
  metric: string;
  actual: number | null;
  threshold: string;
  title: string;
  detail: string;
  action: string;
};

export type FunnelQualityInput = {
  signups: {
    total: number;
    last24h: number;
    last7d: number;
  };
  reliability: {
    productEvents24h: number;
    failedEmails24h: number;
    queuedEmails: number;
  };
  quality: {
    contractRejections24h: number;
    unknownEventNames24h: number;
    missingIdentityEvents24h: number;
    missingDataOriginEvents24h: number;
    unknownOriginRecords: number;
    latestEventAt: string | null;
    eventLagMinutes: number | null;
    uncapturedSignups: number;
    uncapturedSignupRate: number | null;
  };
};

function alert(input: Omit<FunnelQualityAlert, "fingerprint">): FunnelQualityAlert {
  return { ...input, fingerprint: `funnel-quality:v${FUNNEL_QUALITY_ALERT_VERSION}:${input.id}` };
}

/**
 * These are operational guardrails, not product-growth goals. They only flag
 * conditions that make funnel percentages unsafe to interpret or indicate a
 * broken production path. Activation and retention are intentionally not
 * thresholded until we have enough mature cohorts to establish baselines.
 */
export function evaluateFunnelQuality(input: FunnelQualityInput): FunnelQualityAlert[] {
  const alerts: FunnelQualityAlert[] = [];
  const quality = input.quality;

  if (quality.contractRejections24h > 0) {
    alerts.push(alert({
      id: "contract_rejections_24h",
      severity: "critical",
      metric: "contractRejections24h",
      actual: quality.contractRejections24h,
      threshold: "0",
      title: "Product event contracts are rejecting writes",
      detail: `${quality.contractRejections24h} event envelope(s) were rejected in the last 24 hours. Funnel counts may be under-recorded.`,
      action: "Inspect ProductEventIssue by event name and reason, then fix the producer contract before trusting dashboard percentages.",
    }));
  }

  if (quality.unknownEventNames24h > 0) {
    alerts.push(alert({
      id: "unknown_event_names_24h",
      severity: "critical",
      metric: "unknownEventNames24h",
      actual: quality.unknownEventNames24h,
      threshold: "0",
      title: "Unknown product event names are being stored",
      detail: `${quality.unknownEventNames24h} event(s) used a name outside the versioned contract in the last 24 hours.`,
      action: "Trace the producer and either register the event in eventContracts.ts or remove the stale emission.",
    }));
  }

  if (input.signups.last24h > 0 && input.reliability.productEvents24h === 0) {
    alerts.push(alert({
      id: "no_product_events_after_signups",
      severity: "critical",
      metric: "productEvents24h",
      actual: input.reliability.productEvents24h,
      threshold: "> 0 when signups exist",
      title: "Signups are arriving without product events",
      detail: `${input.signups.last24h} account(s) signed up in the last 24 hours, but no product events were recorded.`,
      action: "Check the event write path, database connectivity, and environment filter before using activation or WAU/MAU data.",
    }));
  }

  if (quality.missingIdentityEvents24h > 0) {
    alerts.push(alert({
      id: "missing_identity_events_24h",
      severity: "warning",
      metric: "missingIdentityEvents24h",
      actual: quality.missingIdentityEvents24h,
      threshold: "0",
      title: "Product events are missing identity",
      detail: `${quality.missingIdentityEvents24h} event(s) had neither a user ID nor an anonymous ID in the last 24 hours.`,
      action: "Find the client or server producer that is dropping identity and add a contract test for that path.",
    }));
  }

  if (quality.missingDataOriginEvents24h > 0) {
    alerts.push(alert({
      id: "missing_data_origin_events_24h",
      severity: "warning",
      metric: "missingDataOriginEvents24h",
      actual: quality.missingDataOriginEvents24h,
      threshold: "0",
      title: "Real-data events are missing origin",
      detail: `${quality.missingDataOriginEvents24h} real-data event(s) had no valid user/imported origin in the last 24 hours.`,
      action: "Fix the originating mutation and keep the event excluded from real-data activation until its origin is trustworthy.",
    }));
  }

  if (quality.unknownOriginRecords > 0) {
    alerts.push(alert({
      id: "unknown_origin_records",
      severity: "warning",
      metric: "unknownOriginRecords",
      actual: quality.unknownOriginRecords,
      threshold: "0",
      title: "Business records have unknown origin",
      detail: `${quality.unknownOriginRecords} client/project/invoice/expense/calendar record(s) cannot yet be classified as real or synthetic.`,
      action: "Classify legacy rows with an explicit migration or data-origin operation; do not infer origin from email domains.",
    }));
  }

  if (quality.eventLagMinutes !== null && quality.eventLagMinutes > 30) {
    alerts.push(alert({
      id: "event_lag_minutes",
      severity: "warning",
      metric: "eventLagMinutes",
      actual: quality.eventLagMinutes,
      threshold: "<= 30 minutes",
      title: "The event stream is stale",
      detail: `The latest product event is ${quality.eventLagMinutes} minutes old.`,
      action: "Check event writes and the production database before treating a flat funnel as user behavior.",
    }));
  }

  if (input.signups.last7d >= 5 && quality.uncapturedSignupRate !== null && quality.uncapturedSignupRate > 5) {
    alerts.push(alert({
      id: "uncaptured_signup_source",
      severity: "warning",
      metric: "uncapturedSignupRate",
      actual: quality.uncapturedSignupRate,
      threshold: "<= 5%",
      title: "Acquisition source capture is incomplete",
      detail: `${quality.uncapturedSignups} account(s) have no acquisition source (${quality.uncapturedSignupRate}% overall).`,
      action: "Verify the first-touch capture and onboarding persistence path; do not use source cohorts until this is corrected.",
    }));
  }

  if (input.reliability.failedEmails24h > 0) {
    alerts.push(alert({
      id: "failed_emails_24h",
      severity: "warning",
      metric: "failedEmails24h",
      actual: input.reliability.failedEmails24h,
      threshold: "0",
      title: "Email delivery failures need review",
      detail: `${input.reliability.failedEmails24h} email delivery record(s) failed in the last 24 hours.`,
      action: "Inspect provider responses and the outbox before assuming verification or invoice-send conversion is healthy.",
    }));
  }

  if (input.reliability.queuedEmails >= 50) {
    const critical = input.reliability.queuedEmails >= 250;
    alerts.push(alert({
      id: "queued_email_backlog",
      severity: critical ? "critical" : "warning",
      metric: "queuedEmails",
      actual: input.reliability.queuedEmails,
      threshold: critical ? "< 250" : "< 50",
      title: "The email outbox is building a backlog",
      detail: `${input.reliability.queuedEmails} email job(s) are queued or processing.`,
      action: "Check the outbox worker, provider credentials, and retry errors; verification and invoice delivery are user-facing dependencies.",
    }));
  }

  return alerts;
}
