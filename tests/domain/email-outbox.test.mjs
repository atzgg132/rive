import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { prisma } from "../helpers/prisma-mock.mjs";
import { enqueueEmail, processEmailOutbox, STALE_PROCESSING_MS } from "../../src/utils/emailOutbox.ts";

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

test("a failed send is requeued with backoff instead of being marked sent", async () => {
  const jobId = await enqueueEmail(sampleEmail("retry@example.com"));
  const result = await processEmailOutbox({
    jobId,
    deliver: async () => ({ sent: false, reason: "delivery_failed" }),
  });

  assert.equal(result.retried, 1);
  assert.equal(result.failed, 0);
  const job = prisma.__db.emailOutbox[0];
  assert.equal(job.status, "queued");
  assert.equal(job.lastError, "delivery_failed");
  assert.ok(job.availableAt > new Date(), "backoff must push availableAt into the future");
});

test("the eighth failed attempt is terminal", async () => {
  const jobId = await enqueueEmail(sampleEmail("give-up@example.com"));
  prisma.__db.emailOutbox[0].attempts = 7;

  const result = await processEmailOutbox({
    jobId,
    deliver: async () => ({ sent: false, reason: "delivery_failed" }),
  });

  assert.equal(result.failed, 1);
  assert.equal(prisma.__db.emailOutbox[0].status, "failed");
});

test("terminal invoice delivery failure is reflected on the correlated delivery", async () => {
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
    deliver: async () => ({ sent: false, reason: "delivery_failed" }),
  });

  assert.equal(prisma.__db.invoiceDelivery[0].status, "failed");
  assert.equal(prisma.__db.invoiceDelivery[0].providerMessageId, null);
  assert.equal(prisma.__db.invoiceDelivery[0].error, "delivery_failed");
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
