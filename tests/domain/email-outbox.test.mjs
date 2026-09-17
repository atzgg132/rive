import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { prisma } from "../helpers/prisma-mock.mjs";

// Provider must be pinned before email.ts reads its env at module load:
// "smtp" with no transport yields the deterministic retryable not_configured
// result these tests assert, regardless of ambient CI env (EMAIL_PROVIDER=ses).
process.env.EMAIL_PROVIDER = "smtp";
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const { collectEmailOutboxMetrics, enqueueEmail, processEmailOutbox, STALE_PROCESSING_MS } = await import("../../src/utils/emailOutbox.ts");
const { __emailTestInternals, deliverPreparedEmail } = await import("../../src/utils/email.ts");

const { classifyEmailProviderError, sanitizeEmailDiagnostic } = __emailTestInternals;

function sampleEmail(to, type = "email_verification") {
  return {
    to,
    type,
    subject: `Verify ${to}`,
    html: `<p>Verify ${to}</p>`,
    text: `Verify ${to}`,
  };
}

async function deliveredTypes(deliveries) {
  const types = [];
  await processEmailOutbox({
    limit: 50,
    deliver: async (email) => {
      types.push(email.type);
      deliveries.push(email.to);
      return { sent: true, messageId: `mock-${email.to}` };
    },
  });
  return types;
}

beforeEach(() => {
  prisma.__reset();
});

test("signup-style jobId processing skips older queued inquiry mail", async () => {
  const inquiryId = await enqueueEmail(sampleEmail("owner@example.com", "portfolio_inquiry"));
  const verificationId = await enqueueEmail(sampleEmail("new@example.com", "email_verification"));
  assert.notEqual(inquiryId, verificationId);

  const delivered = [];
  const result = await processEmailOutbox({
    jobId: verificationId,
    deliver: async (email) => {
      delivered.push(email.type);
      return { sent: true, messageId: "verification" };
    },
  });

  assert.equal(result.sent, 1);
  assert.deepEqual(delivered, ["email_verification"]);
  const inquiry = prisma.__db.emailOutbox.find((job) => job.id === inquiryId);
  const verification = prisma.__db.emailOutbox.find((job) => job.id === verificationId);
  assert.equal(inquiry.status, "queued", "older inquiry mail must remain queued for the worker");
  assert.equal(verification.status, "sent");
});

test("invoice_sent jobId processing skips older queued inquiry mail", async () => {
  const inquiryId = await enqueueEmail(sampleEmail("owner@example.com", "portfolio_inquiry"));
  const invoiceId = await enqueueEmail(sampleEmail("client@example.com", "invoice_sent"));
  prisma.__db.invoiceDelivery.push({
    id: invoiceId,
    invoiceId: "invoice-1",
    status: "queued",
    providerMessageId: null,
    error: "queued_for_retry",
    sentAt: null,
  });

  const delivered = [];
  const result = await processEmailOutbox({
    jobId: invoiceId,
    deliver: async (email) => {
      delivered.push(email.type);
      return { sent: true, messageId: "invoice" };
    },
  });

  assert.equal(result.sent, 1);
  assert.deepEqual(delivered, ["invoice_sent"]);
  assert.equal(prisma.__db.emailOutbox.find((job) => job.id === inquiryId).status, "queued");
  assert.equal(prisma.__db.emailOutbox.find((job) => job.id === invoiceId).status, "sent");
  const invoiceDelivery = prisma.__db.invoiceDelivery.find((delivery) => delivery.id === invoiceId);
  assert.equal(invoiceDelivery.status, "sent");
  assert.equal(invoiceDelivery.providerMessageId, "invoice");
  assert.equal(invoiceDelivery.error, null);
  assert.ok(invoiceDelivery.sentAt);
});

test("the worker still drains the oldest job when no jobId is given", async () => {
  await enqueueEmail(sampleEmail("owner@example.com", "portfolio_inquiry"));
  await enqueueEmail(sampleEmail("new@example.com", "email_verification"));

  const delivered = [];
  await processEmailOutbox({
    limit: 1,
    deliver: async (email) => {
      delivered.push(email.type);
      return { sent: true, messageId: "oldest" };
    },
  });

  assert.deepEqual(delivered, ["portfolio_inquiry"]);
});

test("jobs left in processing after a killed request are reclaimed", async () => {
  const jobId = await enqueueEmail(sampleEmail("stuck@example.com"));
  const job = prisma.__db.emailOutbox.find((row) => row.id === jobId);
  job.status = "processing";
  job.updatedAt = new Date(Date.now() - STALE_PROCESSING_MS - 1_000);

  const result = await processEmailOutbox({
    deliver: async () => ({ sent: true, messageId: "reclaimed" }),
  });

  assert.equal(result.reclaimed, 1);
  assert.equal(result.sent, 1);
  assert.equal(prisma.__db.emailOutbox[0].status, "sent");
});

test("a killed final attempt is reclaimed for one final retry", async () => {
  const jobId = await enqueueEmail(sampleEmail("final-attempt@example.com"));
  const job = prisma.__db.emailOutbox.find((row) => row.id === jobId);
  job.status = "processing";
  job.attempts = 8;
  job.updatedAt = new Date(Date.now() - STALE_PROCESSING_MS - 1_000);

  const result = await processEmailOutbox({
    deliver: async () => ({ sent: true, messageId: "final-retry" }),
  });

  assert.equal(result.reclaimed, 1);
  assert.equal(result.sent, 1);
  assert.equal(job.status, "sent");
  assert.equal(job.attempts, 8);
});

test("revoked Agreement signing links are not delivered from the queue", async () => {
  prisma.__db.contractReviewLink.push({
    id: "active-link",
    signerId: "signer-1",
    tokenHash: "active-hash",
    type: "sign",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  });
  const obsoleteId = await enqueueEmail({
    ...sampleEmail("client@example.com", "contract_signing"),
    deliveryGuard: { kind: "contract_signing", signerId: "signer-1", tokenHash: "revoked-hash" },
  });
  const activeId = await enqueueEmail({
    ...sampleEmail("client@example.com", "contract_signing"),
    deliveryGuard: { kind: "contract_signing", signerId: "signer-1", tokenHash: "active-hash" },
  });
  const delivered = [];

  const result = await processEmailOutbox({
    limit: 2,
    deliver: async (email) => {
      delivered.push(email.deliveryGuard.tokenHash);
      return { sent: true, messageId: "active" };
    },
  });

  assert.deepEqual(delivered, ["active-hash"]);
  assert.equal(prisma.__db.emailOutbox.find((job) => job.id === obsoleteId).status, "failed");
  assert.equal(prisma.__db.emailOutbox.find((job) => job.id === activeId).status, "sent");
  assert.equal(result.failed, 1);
  assert.equal(result.sent, 1);
});

test("a stale Agreement review link terminal-fails its queued invite", async () => {
  const link = {
    id: "review-link-1",
    contractId: "contract-1",
    tokenHash: "review-hash",
    type: "review",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };
  const activeId = await enqueueEmail({
    ...sampleEmail("client@example.com", "contract_review"),
    deliveryGuard: { kind: "contract_review", linkId: link.id, tokenHash: "review-hash" },
  });
  const revokedId = await enqueueEmail({
    ...sampleEmail("client@example.com", "contract_review"),
    deliveryGuard: { kind: "contract_review", linkId: "revoked-link", tokenHash: "revoked-hash" },
  });
  const expiredId = await enqueueEmail({
    ...sampleEmail("client@example.com", "contract_review"),
    deliveryGuard: { kind: "contract_review", linkId: "expired-link", tokenHash: "expired-hash" },
  });
  prisma.__db.contractReviewLink.push(
    link,
    { ...link, id: "revoked-link", tokenHash: "revoked-hash", revokedAt: new Date() },
    { ...link, id: "expired-link", tokenHash: "expired-hash", expiresAt: new Date(Date.now() - 60_000) },
  );

  const delivered = [];
  const result = await processEmailOutbox({
    limit: 5,
    deliver: async (email) => {
      delivered.push(email.deliveryGuard.linkId);
      return { sent: true, messageId: "review-mail" };
    },
  });

  assert.deepEqual(delivered, ["review-link-1"]);
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 2);
  const jobs = Object.fromEntries(prisma.__db.emailOutbox.map((job) => [job.id, job]));
  assert.equal(jobs[activeId].status, "sent");
  assert.ok(jobs[activeId].processedAt instanceof Date);
  for (const id of [revokedId, expiredId]) {
    assert.equal(jobs[id].status, "failed");
    assert.ok(jobs[id].processedAt instanceof Date);
    assert.match(jobs[id].lastError, /replaced or expired/i);
  }
});

test("voided invoice links are not delivered from the queue", async () => {
  prisma.__db.invoice.push({
    id: "invoice-voided",
    userId: "user-1",
    status: "void",
    publicTokenHash: "invoice-token-hash",
    sentSnapshot: { total: "100" },
    sentAt: new Date(),
  });
  const jobId = await enqueueEmail({
    ...sampleEmail("voided@example.com", "invoice_sent"),
    deliveryGuard: {
      kind: "invoice_sent",
      invoiceId: "invoice-voided",
      tokenHash: "invoice-token-hash",
    },
  });

  const result = await processEmailOutbox({ provider: "console", jobId });

  assert.equal(result.sent, 0);
  assert.equal(result.failed, 1);
  const job = prisma.__db.emailOutbox.find((row) => row.id === jobId);
  assert.equal(job.status, "failed");
  assert.match(job.lastError, /replaced or expired/i);
});

test("a processing job that is still young is not stolen by another worker", async () => {
  const jobId = await enqueueEmail(sampleEmail("inflight@example.com"));
  const job = prisma.__db.emailOutbox.find((row) => row.id === jobId);
  job.status = "processing";
  job.updatedAt = new Date();

  const result = await processEmailOutbox({
    deliver: async () => ({ sent: true, messageId: "should-not-run" }),
  });

  assert.equal(result.reclaimed, 0);
  assert.equal(result.claimed, 0);
  assert.equal(prisma.__db.emailOutbox[0].status, "processing");
});

test("the cron deadline stops after the first job so later rows stay queued", async () => {
  await enqueueEmail(sampleEmail("one@example.com"));
  await enqueueEmail(sampleEmail("two@example.com"));
  await enqueueEmail(sampleEmail("three@example.com"));

  const result = await processEmailOutbox({
    limit: 8,
    deadlineMs: 0,
    deliver: async () => ({ sent: true, messageId: "one" }),
  });

  assert.equal(result.sent, 1);
  assert.equal(prisma.__db.emailOutbox.filter((job) => job.status === "queued").length, 2);
});

test("a transient failure is requeued with backoff instead of being marked sent", async () => {
  const jobId = await enqueueEmail(sampleEmail("retry@example.com"));
  const result = await processEmailOutbox({
    jobId,
    deliver: async () => ({ sent: false, reason: "transient_failure", retryable: true, providerCode: "451" }),
  });

  assert.equal(result.retried, 1);
  assert.equal(result.failed, 0);
  const job = prisma.__db.emailOutbox[0];
  assert.equal(job.status, "queued");
  assert.equal(job.lastError, "transient_failure:451");
  assert.equal(job.processedAt, null);
  assert.ok(job.availableAt > new Date(), "backoff must push availableAt into the future");
});

test("a not_configured result requeues while attempts remain", async () => {
  const jobId = await enqueueEmail(sampleEmail("unconfigured@example.com"));
  const result = await processEmailOutbox({
    jobId,
    deliver: async () => ({ sent: false, reason: "not_configured", retryable: true }),
  });

  assert.equal(result.retried, 1);
  assert.equal(result.failed, 0);
  const job = prisma.__db.emailOutbox[0];
  assert.equal(job.status, "queued");
  assert.equal(job.lastError, "not_configured");
  assert.equal(job.processedAt, null);
  assert.ok(job.availableAt > new Date(), "backoff must push availableAt into the future");
});

test("a permanent failure is attempted once and settles terminal state", async () => {
  const jobId = await enqueueEmail(sampleEmail("bounced@example.com"));
  const seededAvailableAt = prisma.__db.emailOutbox[0].availableAt.getTime();
  let attempts = 0;
  const result = await processEmailOutbox({
    jobId,
    deliver: async () => {
      attempts += 1;
      return { sent: false, reason: "permanent_failure", retryable: false, providerCode: "MessageRejected" };
    },
  });

  assert.equal(attempts, 1, "a permanent failure must not be retried");
  assert.equal(result.failed, 1);
  assert.equal(result.retried, 0);
  const job = prisma.__db.emailOutbox[0];
  assert.equal(job.status, "failed");
  assert.equal(job.attempts, 1);
  assert.equal(job.lastError, "permanent_failure:MessageRejected");
  assert.ok(!/@/.test(job.lastError), "lastError must never carry an address-bearing diagnostic");
  assert.ok(job.processedAt instanceof Date, "a terminal job must be stamped processedAt");
  assert.equal(job.availableAt.getTime(), seededAvailableAt, "a terminal job must not advance availableAt");
});

test("the eighth transient failure is terminal", async () => {
  const jobId = await enqueueEmail(sampleEmail("give-up@example.com"));
  prisma.__db.emailOutbox[0].attempts = 7;
  const seededAvailableAt = prisma.__db.emailOutbox[0].availableAt.getTime();

  const result = await processEmailOutbox({
    jobId,
    deliver: async () => ({ sent: false, reason: "transient_failure", retryable: true }),
  });

  assert.equal(result.failed, 1);
  const job = prisma.__db.emailOutbox[0];
  assert.equal(job.status, "failed");
  assert.equal(job.lastError, "transient_failure");
  assert.ok(job.processedAt instanceof Date);
  assert.equal(job.availableAt.getTime(), seededAvailableAt);
});

test("a thrown provider error requeues while attempts remain", async () => {
  const jobId = await enqueueEmail(sampleEmail("flaky@example.com"));

  const result = await processEmailOutbox({
    jobId,
    deliver: async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.1:587");
    },
  });

  assert.equal(result.retried, 1);
  assert.equal(result.failed, 0);
  const job = prisma.__db.emailOutbox[0];
  assert.equal(job.status, "queued");
  assert.equal(job.processedAt, null);
  assert.ok(job.availableAt > new Date());
});

test("a thrown provider error on the final attempt is terminal", async () => {
  const jobId = await enqueueEmail(sampleEmail("dead@example.com"));
  prisma.__db.emailOutbox[0].attempts = 7;
  const seededAvailableAt = prisma.__db.emailOutbox[0].availableAt.getTime();

  const result = await processEmailOutbox({
    jobId,
    deliver: async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.1:587");
    },
  });

  assert.equal(result.failed, 1);
  assert.equal(result.retried, 0);
  const job = prisma.__db.emailOutbox[0];
  assert.equal(job.status, "failed");
  assert.ok(job.processedAt instanceof Date);
  assert.equal(job.availableAt.getTime(), seededAvailableAt);
});

test("a permanent failure settles the correlated invoice delivery on the first attempt", async () => {
  const jobId = await enqueueEmail(sampleEmail("client@example.com", "invoice_sent"));
  prisma.__db.invoiceDelivery.push({
    id: jobId,
    invoiceId: "invoice-1",
    status: "queued",
    providerMessageId: null,
    error: "queued_for_retry",
    sentAt: null,
  });

  const result = await processEmailOutbox({
    jobId,
    deliver: async () => ({ sent: false, reason: "permanent_failure", retryable: false, providerCode: "550" }),
  });

  assert.equal(result.failed, 1);
  assert.equal(result.retried, 0);
  assert.equal(prisma.__db.invoiceDelivery[0].status, "failed");
  assert.equal(prisma.__db.invoiceDelivery[0].providerMessageId, null);
  assert.equal(prisma.__db.invoiceDelivery[0].error, "permanent_failure:550");
  assert.equal(prisma.__db.invoiceDelivery[0].sentAt, null);
});

test("a permanent failure settles the correlated inquiry notification on the first attempt", async () => {
  const jobId = await enqueueEmail(sampleEmail("owner@example.com", "portfolio_inquiry"));
  prisma.__db.portfolioInquiry.push({
    id: "inquiry-1",
    outboxId: jobId,
    notificationStatus: "queued",
    notificationError: null,
  });

  const result = await processEmailOutbox({
    jobId,
    deliver: async () => ({ sent: false, reason: "permanent_failure", retryable: false, providerCode: "MessageRejected" }),
  });

  assert.equal(result.failed, 1);
  assert.equal(result.retried, 0);
  assert.equal(prisma.__db.portfolioInquiry[0].notificationStatus, "failed");
  assert.equal(prisma.__db.portfolioInquiry[0].notificationError, "permanent_failure:MessageRejected");
});

test("terminal invoice delivery failure is reflected on the correlated delivery after retries exhaust", async () => {
  const jobId = await enqueueEmail(sampleEmail("client@example.com", "invoice_sent"));
  prisma.__db.emailOutbox[0].attempts = 7;
  prisma.__db.invoiceDelivery.push({
    id: jobId,
    invoiceId: "invoice-1",
    status: "queued",
    providerMessageId: null,
    error: "queued_for_retry",
    sentAt: null,
  });

  await processEmailOutbox({
    jobId,
    deliver: async () => ({ sent: false, reason: "transient_failure", retryable: true }),
  });

  assert.equal(prisma.__db.invoiceDelivery[0].status, "failed");
  assert.equal(prisma.__db.invoiceDelivery[0].providerMessageId, null);
  assert.equal(prisma.__db.invoiceDelivery[0].error, "transient_failure");
  assert.equal(prisma.__db.invoiceDelivery[0].sentAt, null);
});

test("a successful drain of mixed jobs still records every recipient", async () => {
  await enqueueEmail(sampleEmail("a@example.com", "email_verification"));
  await enqueueEmail(sampleEmail("b@example.com", "password_reset"));
  const deliveries = [];
  const types = await deliveredTypes(deliveries);
  assert.deepEqual(types, ["email_verification", "password_reset"]);
  assert.deepEqual(deliveries, ["a@example.com", "b@example.com"]);
});

test("collectEmailOutboxMetrics reports queue age, in-flight depth, and recent terminal failures", async () => {
  const now = new Date();
  const waitingId = await enqueueEmail(sampleEmail("waiting@example.com"));
  const backoffId = await enqueueEmail(sampleEmail("backoff@example.com"));
  const inflightId = await enqueueEmail(sampleEmail("inflight@example.com"));
  const recentFailureId = await enqueueEmail(sampleEmail("recent-failure@example.com"));
  const oldFailureId = await enqueueEmail(sampleEmail("old-failure@example.com"));

  const jobs = Object.fromEntries(prisma.__db.emailOutbox.map((job) => [job.id, job]));
  // The oldest waiting job has sat for 90 seconds and is due now. availableAt
  // is pinned rather than left at enqueue time so the lte bound cannot race.
  jobs[waitingId].createdAt = new Date(now.getTime() - 90_000);
  jobs[waitingId].availableAt = new Date(now.getTime() - 1_000);
  // A retry-backoff row is queued but not yet due — it must not count as
  // waiting even though it is the oldest row in the table.
  jobs[backoffId].createdAt = new Date(now.getTime() - 600_000);
  jobs[backoffId].availableAt = new Date(now.getTime() + 60_000);
  jobs[inflightId].status = "processing";
  jobs[recentFailureId].status = "failed";
  jobs[recentFailureId].processedAt = new Date(now.getTime() - 30 * 60_000);
  jobs[oldFailureId].status = "failed";
  jobs[oldFailureId].processedAt = new Date(now.getTime() - 2 * 60 * 60_000);

  const metrics = await collectEmailOutboxMetrics(now);
  assert.equal(metrics.oldestQueuedSeconds, 90);
  assert.equal(metrics.processingCount, 1);
  assert.equal(metrics.terminalFailuresLastHour, 1);
});

test("collectEmailOutboxMetrics reports zero queue age when nothing is waiting", async () => {
  const metrics = await collectEmailOutboxMetrics(new Date());
  assert.equal(metrics.oldestQueuedSeconds, 0);
  assert.equal(metrics.processingCount, 0);
  assert.equal(metrics.terminalFailuresLastHour, 0);
});

test("suppressed recipients are not delivered and settle as terminal failures", async () => {
  prisma.__db.emailSuppression.push({ id: "suppression-1", email: "suppressed@example.com", reason: "bounce", source: "ses" });
  const jobId = await enqueueEmail(sampleEmail("Suppressed@Example.com"));
  let attempted = false;

  const result = await processEmailOutbox({
    jobId,
    deliver: async () => {
      attempted = true;
      return { sent: true, messageId: "should-not-send" };
    },
  });

  assert.equal(attempted, false);
  assert.equal(result.failed, 1);
  const job = prisma.__db.emailOutbox.find((entry) => entry.id === jobId);
  assert.equal(job.status, "failed");
  assert.equal(job.lastError, "Recipient is suppressed.");
});

test("contact message notification state settles with its outbox job", async () => {
  const jobId = await enqueueEmail(sampleEmail("hello@rive.work", "contact_message"));
  prisma.__db.contactMessage.push({
    id: "contact-1",
    outboxId: jobId,
    notificationStatus: "queued",
    notificationError: null,
  });

  const result = await processEmailOutbox({
    jobId,
    deliver: async () => ({ sent: true, messageId: "contact-provider-id" }),
  });

  assert.equal(result.sent, 1);
  assert.equal(prisma.__db.contactMessage[0].notificationStatus, "sent");
  assert.equal(prisma.__db.contactMessage[0].notificationError, null);
});

test("queued payloads survive email outbox key rotation", async () => {
  const prior = {
    EMAIL_OUTBOX_KEY: process.env.EMAIL_OUTBOX_KEY,
    EMAIL_OUTBOX_KEY_ID: process.env.EMAIL_OUTBOX_KEY_ID,
    EMAIL_OUTBOX_KEY_PREVIOUS: process.env.EMAIL_OUTBOX_KEY_PREVIOUS,
    EMAIL_OUTBOX_KEY_PREVIOUS_ID: process.env.EMAIL_OUTBOX_KEY_PREVIOUS_ID,
  };
  try {
    process.env.EMAIL_OUTBOX_KEY = "old-outbox-secret";
    delete process.env.EMAIL_OUTBOX_KEY_ID;
    delete process.env.EMAIL_OUTBOX_KEY_PREVIOUS;
    delete process.env.EMAIL_OUTBOX_KEY_PREVIOUS_ID;
    const jobId = await enqueueEmail(sampleEmail("rotate@example.com"));

    process.env.EMAIL_OUTBOX_KEY = "new-outbox-secret";
    process.env.EMAIL_OUTBOX_KEY_ID = "v2";
    process.env.EMAIL_OUTBOX_KEY_PREVIOUS = "old-outbox-secret";
    process.env.EMAIL_OUTBOX_KEY_PREVIOUS_ID = "v1";

    const result = await processEmailOutbox({
      jobId,
      deliver: async (email) => ({ sent: true, messageId: `rotated-${email.to}` }),
    });
    assert.equal(result.sent, 1);
    assert.equal(prisma.__db.emailOutbox.find((job) => job.id === jobId).status, "sent");
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("deliverPreparedEmail reports a retryable not_configured result when no provider is set", async () => {
  prisma.emailDelivery = { create: async ({ data }) => data };
  const result = await deliverPreparedEmail(sampleEmail("nobody@example.com"));

  assert.equal(result.sent, false);
  assert.equal(result.reason, "not_configured");
  assert.equal(result.retryable, true);
});

test("SMTP 5xx responses classify as permanent and not retryable", () => {
  const error = new Error("550 5.1.1 <bounced@example.com>: Recipient address rejected");
  error.responseCode = 550;
  const result = classifyEmailProviderError(error);

  assert.equal(result.reason, "permanent_failure");
  assert.equal(result.retryable, false);
  assert.equal(result.providerCode, "550");
  assert.ok(!result.diagnostic.includes("bounced@example.com"), "the stored diagnostic must not carry the recipient");
});

test("SMTP 4xx responses classify as transient and retryable", () => {
  const error = new Error("451 4.7.1 Greylisted, try again later");
  error.responseCode = 451;
  const result = classifyEmailProviderError(error);

  assert.equal(result.reason, "transient_failure");
  assert.equal(result.retryable, true);
  assert.equal(result.providerCode, "451");
});

test("SES rejection names classify as permanent", () => {
  for (const name of ["MessageRejected", "InvalidParameterValue", "InvalidParameter"]) {
    const error = new Error("Rejected");
    error.name = name;
    const result = classifyEmailProviderError(error);
    assert.equal(result.reason, "permanent_failure", name);
    assert.equal(result.retryable, false, name);
    assert.equal(result.providerCode, name);
  }
});

test("network and unknown failures classify as transient", () => {
  const refused = new Error("connect ECONNREFUSED 10.0.0.1:587");
  refused.code = "ECONNREFUSED";
  const result = classifyEmailProviderError(refused);
  assert.equal(result.reason, "transient_failure");
  assert.equal(result.retryable, true);
  assert.equal(result.providerCode, "ECONNREFUSED");

  const odd = classifyEmailProviderError("string failure");
  assert.equal(odd.reason, "transient_failure");
  assert.equal(odd.retryable, true);
  assert.equal(odd.providerCode, undefined);
});

test("diagnostics redact addresses, credential URLs, and control noise", () => {
  const diagnostic = sanitizeEmailDiagnostic(
    "554 rejected <victim@example.com>\r\nrelay smtps://user:secretpass@mail.example.com bounced for not-an-email@ and jj.jkj@. retry later",
  );

  assert.ok(!diagnostic.includes("victim@example.com"));
  assert.ok(!diagnostic.includes("secretpass"));
  assert.ok(!diagnostic.includes("not-an-email@"));
  assert.ok(!diagnostic.includes("jj.jkj@."));
  assert.ok(!/[\r\n]/.test(diagnostic));
});

test("diagnostics are capped at 500 characters and provider codes at 80", () => {
  assert.ok(sanitizeEmailDiagnostic("x".repeat(2000)).length <= 500);
  const error = new Error("failed");
  error.code = "C".repeat(200);
  assert.equal(classifyEmailProviderError(error).providerCode.length, 80);
});
