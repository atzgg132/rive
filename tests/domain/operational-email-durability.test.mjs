import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { prisma } from "../helpers/prisma-mock.mjs";
import { NextRequest } from "../helpers/next-server-shim.mjs";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-operational-email-secret";

// Pin the provider before the imports below transitively load email.ts, which
// evaluates the ambient env once at module load. "smtp" with no transport
// yields the deterministic retryable not_configured path these tests assert
// (CI sets EMAIL_PROVIDER=ses, which would attempt a real SES send).
process.env.EMAIL_PROVIDER = "smtp";
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const { generateUserToken } = await import("../../src/utils/userAuth.ts");
const { POST: resetPasswordPost } = await import("../../src/app/api/auth/reset-password/route.ts");
const { POST: reviewPost } = await import("../../src/app/api/workflow/contracts/[id]/review/route.ts");

const contractSignRoute = await readFile(
  new URL("../../src/utils/agreementAcceptance.ts", import.meta.url),
  "utf8",
);
const contractBilling = await readFile(
  new URL("../../src/utils/contractBilling.ts", import.meta.url),
  "utf8",
);
const invoicesRoute = await readFile(
  new URL("../../src/app/api/workflow/invoices/route.ts", import.meta.url),
  "utf8",
);
const invoiceSendRoute = await readFile(
  new URL("../../src/app/api/workflow/invoices/[id]/send/route.ts", import.meta.url),
  "utf8",
);
const startSigningRoute = await readFile(
  new URL("../../src/app/api/workflow/contracts/[id]/start-signing/route.ts", import.meta.url),
  "utf8",
);
const signingLinksRoute = await readFile(
  new URL("../../src/app/api/workflow/contracts/[id]/signing-links/route.ts", import.meta.url),
  "utf8",
);
const invoiceSendUtils = await readFile(
  new URL("../../src/utils/invoiceSend.ts", import.meta.url),
  "utf8",
);
const publicInvoiceRoute = await readFile(
  new URL("../../src/app/api/public/invoices/[token]/route.ts", import.meta.url),
  "utf8",
);
const invoiceDetailRoute = await readFile(
  new URL("../../src/app/api/workflow/invoices/[id]/route.ts", import.meta.url),
  "utf8",
);
const emailOutbox = await readFile(
  new URL("../../src/utils/emailOutbox.ts", import.meta.url),
  "utf8",
);
const revenuePage = await readFile(
  new URL("../../src/app/(dashboard)/workflow/revenue/page.tsx", import.meta.url),
  "utf8",
);
const invoiceDetail = await readFile(
  new URL("../../src/components/invoices/InvoiceDetailPanel.tsx", import.meta.url),
  "utf8",
);
const resetPasswordRoute = await readFile(
  new URL("../../src/app/api/auth/reset-password/route.ts", import.meta.url),
  "utf8",
);
const reviewRoute = await readFile(
  new URL("../../src/app/api/workflow/contracts/[id]/review/route.ts", import.meta.url),
  "utf8",
);
const loginRoute = await readFile(
  new URL("../../src/app/api/auth/login/route.ts", import.meta.url),
  "utf8",
);
const googleCallbackRoute = await readFile(
  new URL("../../src/app/api/auth/google/callback/route.ts", import.meta.url),
  "utf8",
);

test("executed Agreement email jobs are persisted in the acceptance transaction", () => {
  assert.match(
    contractSignRoute,
    /enqueueEmail\(buildContractExecutedEmail\([\s\S]*?\), tx\)/,
  );
});

test("Agreement-generated invoice email is persisted with the invoice transaction", () => {
  assert.match(
    contractBilling,
    /enqueueEmail\(buildInvoiceReadyEmail\([\s\S]*?\), tx\)/,
  );
});

test("Agreement-generated invoice email gets a best-effort immediate attempt", () => {
  assert.match(contractBilling, /processEmailOutbox\(\{ jobId: outboxId \}\)[\s\S]*?\.catch\(/);
});

test("invoice send, edit, and delete use optimistic concurrency", () => {
  assert.match(invoiceSendRoute, /status: invoice\.status,[\s\S]*?updatedAt: invoice\.updatedAt/);
  assert.match(invoicesRoute, /updateMany\([\s\S]*?updatedAt: existingInvoice\.updatedAt/);
  assert.match(invoicesRoute, /deleteMany\([\s\S]*?updatedAt: existingInvoice\.updatedAt/);
});

test("invoice completion can only be performed by its own send claim", () => {
  assert.match(invoiceSendRoute, /data: \{ status: "sending", publicTokenHash: tokenHash \}/);
  assert.match(invoiceSendRoute, /status: "sending", publicTokenHash: tokenHash/);
  assert.match(invoiceSendRoute, /if \(issued\.count !== 1\)/);
});

test("invoice email delivery is guarded by the current issued token", async () => {
  const retryRoute = await readFile(
    new URL("../../src/app/api/workflow/invoices/[id]/retry-delivery/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    invoiceSendRoute,
    /deliveryGuard: \{ kind: "invoice_sent", invoiceId: id, tokenHash \}/,
  );
  assert.match(retryRoute, /status: \{ in: \["sent", "viewed", "overdue"\] \}/);
});

test("Agreement mail fast paths cannot turn committed work into an HTTP failure", () => {
  assert.match(startSigningRoute, /processEmailOutbox\([\s\S]*?\.catch\(/);
  assert.match(signingLinksRoute, /processEmailOutbox\([\s\S]*?\.catch\(/);
});

test("Agreement sign-link reissue is single-active and guards queued mail", async () => {
  const migration = await readFile(
    new URL("../../prisma/migrations/20260828034000_contract_sign_link_single_active/migration.sql", import.meta.url),
    "utf8",
  ).catch(() => "");
  assert.match(migration, /BEGIN;[\s\S]*?LOCK TABLE "contract_review_links"[\s\S]*?COMMIT;/);
  assert.match(migration, /CREATE UNIQUE INDEX[\s\S]*?contract_review_links[\s\S]*?revoked_at" IS NULL/);
  assert.match(signingLinksRoute, /deliveryGuard: \{ kind: "contract_signing"/);
  assert.match(signingLinksRoute, /P2002/);
});

test("public invoice first-view state and audit event are atomic", () => {
  assert.match(invoiceSendUtils, /recordPublicInvoiceView[\s\S]*?prisma\.\$transaction\(async \(tx\)/);
  assert.match(invoiceSendUtils, /tx\.invoiceEvent\.create/);
});

test("invoice analytics cannot make the public invoice unavailable", () => {
  assert.match(publicInvoiceRoute, /recordProductEvent\([\s\S]*?\.catch\(/);
});

test("terminal outbox and correlated delivery states commit together", () => {
  assert.match(emailOutbox, /prisma\.\$transaction\(async \(tx\)[\s\S]*?tx\.emailOutbox\.update[\s\S]*?settleNotificationState\(tx/);
});

test("invoice UI distinguishes queued mail and preserves the fallback public link", () => {
  for (const source of [revenuePage, invoiceDetail]) {
    assert.match(source, /data\.delivered/);
    assert.match(source, /data\.publicUrl/);
    assert.match(source, /navigator\.clipboard\.writeText/);
  }
});

test("terminal invoice delivery failure is visible and retryable", async () => {
  const retryRoute = await readFile(
    new URL("../../src/app/api/workflow/invoices/[id]/retry-delivery/route.ts", import.meta.url),
    "utf8",
  ).catch(() => "");
  assert.match(invoiceDetailRoute, /latest_delivery/);
  assert.match(invoiceDetail, /latest_delivery/);
  assert.match(invoiceDetail, /retry-delivery/);
  assert.match(retryRoute, /status: \{ in: \["failed", "delivery_failed"\] \}/);
  assert.match(retryRoute, /processEmailOutbox\(\{ jobId: delivery\.id \}\)/);
});

test("sign-in handlers no longer send an unconditional login-success email", () => {
  assert.doesNotMatch(loginRoute, /sendLoginSuccessEmail/);
  assert.doesNotMatch(googleCallbackRoute, /sendLoginSuccessEmail/);
});

test("password-change mail is enqueued inside the reset transaction and attempted best-effort", () => {
  assert.match(
    resetPasswordRoute,
    /prisma\.\$transaction\(async \(transaction\)[\s\S]*?return enqueueEmail\(buildPasswordChangedEmail\(resetToken\.email\), transaction\)/,
  );
  assert.match(resetPasswordRoute, /if \(!outboxId\)[\s\S]*?409/);
  assert.match(resetPasswordRoute, /getEmailProvider\(\) !== "disabled"[\s\S]*?processEmailOutbox\(\{ jobId: outboxId \}\)\.catch\(/);
});

test("Agreement review mail is enqueued in the link transaction and reports queue honestly", () => {
  assert.match(reviewRoute, /deliveryGuard: \{ kind: "contract_review", linkId: link\.id, tokenHash \}/);
  assert.match(
    reviewRoute,
    /prisma\.\$transaction\(async \(tx\)[\s\S]*?enqueueEmail\([\s\S]*?buildContractReviewEmail[\s\S]*?\}, tx\)/,
  );
  assert.match(reviewRoute, /processEmailOutbox\(\{ jobId: outboxId \}\)\.catch\(/);
  assert.match(reviewRoute, /email: shouldEmail \? \{ queued: true, sent: delivered \} : null/);
});

function resetRequest(body) {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function installResetMocks({ claimCount = 1 } = {}) {
  const calls = { tokenUpdateMany: [], userUpdate: [] };
  prisma.authToken = {
    async findFirst() {
      return { id: "token-1", userId: "user-1", email: "member@example.com", usedAt: null, expiresAt: new Date(Date.now() + 60_000) };
    },
    async updateMany(args) {
      calls.tokenUpdateMany.push(args);
      return { count: claimCount };
    },
    async create() {
      return {};
    },
  };
  prisma.user.update = async (args) => {
    calls.userUpdate.push(args);
    return { id: "user-1" };
  };
  prisma.emailDelivery = { create: async () => ({}) };
  return calls;
}

test("a committed password reset queues the notice and survives an immediate delivery failure", async () => {
  prisma.__reset();
  const calls = installResetMocks();

  const response = await resetPasswordPost(resetRequest({ token: "reset-token", password: "replacement-password-1" }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(calls.userUpdate.length, 1);
  assert.equal(calls.tokenUpdateMany.length, 2);
  const jobs = prisma.__db.emailOutbox;
  assert.equal(jobs.length, 1, "the notice must be enqueued by the reset transaction");
  assert.equal(jobs[0].type, "password_changed");
  assert.equal(jobs[0].recipient, "member@example.com");
  assert.equal(jobs[0].status, "queued", "with no live provider the job stays queued for the worker");
  assert.equal(jobs[0].lastError, "not_configured");
});

test("a lost reset claim returns 409 and queues no mail", async () => {
  prisma.__reset();
  installResetMocks({ claimCount: 0 });

  const response = await resetPasswordPost(resetRequest({ token: "reset-token", password: "replacement-password-1" }));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.success, false);
  assert.equal(prisma.__db.emailOutbox.length, 0);
});

const CONTRACT_ROW = {
  id: "contract-1",
  userId: "user-1",
  title: "Service Agreement",
  status: "draft",
  client: { name: "Client Name", email: "client@example.com" },
  user: { name: "Owner Name", email: "owner@example.com" },
  versions: [{ id: "version-1", version: 1, status: "draft" }],
};

function installReviewMocks() {
  prisma.__reset();
  prisma.__db.user.push({
    id: "user-1",
    email: "owner@example.com",
    plan: "free",
    sessionVersion: 3,
    emailVerifiedAt: new Date(),
    emailVerificationRequiredAt: new Date(),
  });
  const calls = { contractUpdateMany: [], contractEvent: [] };
  prisma.contract = {
    async findFirst() {
      return { ...CONTRACT_ROW };
    },
    async updateMany(args) {
      calls.contractUpdateMany.push(args);
      return { count: 1 };
    },
  };
  prisma.contractReviewLink.updateMany = async () => ({ count: 0 });
  prisma.contractReviewLink.create = async ({ data }) => {
    const link = { id: "review-link-1", signerId: null, revokedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data };
    prisma.__db.contractReviewLink.push(link);
    return link;
  };
  prisma.contractEvent = {
    create: async (args) => {
      calls.contractEvent.push(args);
      return { id: "event-1" };
    },
  };
  prisma.productEvent = { create: async () => ({}) };
  prisma.productEventIssue = { create: async () => ({}) };
  prisma.emailDelivery = { create: async () => ({}) };
  return calls;
}

function reviewRequest(body, sessionVersion = 3) {
  const token = generateUserToken("user-1", "owner@example.com", "free", sessionVersion);
  return new NextRequest("http://localhost/api/workflow/contracts/contract-1/review", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `rive_session=${token}` },
    body: JSON.stringify(body),
  });
}

test("a review invite is queued in the link transaction and reports queued-not-sent honestly", async () => {
  const calls = installReviewMocks();

  const response = await reviewPost(reviewRequest({ sendEmail: true }), { params: Promise.resolve({ id: "contract-1" }) });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.ok(payload.reviewUrl.includes("/review/"));
  assert.deepEqual(payload.email, { queued: true, sent: false });
  const jobs = prisma.__db.emailOutbox;
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].type, "contract_review");
  assert.equal(jobs[0].recipient, "client@example.com");
  assert.equal(jobs[0].status, "queued");
  assert.equal(calls.contractEvent.length, 1);
  assert.equal(calls.contractUpdateMany.length, 1);
  const link = prisma.__db.contractReviewLink[0];
  assert.equal(link.type, "review");
  assert.ok(link.tokenHash);
});

test("a review link without email queues nothing and reports no email", async () => {
  installReviewMocks();

  const response = await reviewPost(reviewRequest({ sendEmail: false }), { params: Promise.resolve({ id: "contract-1" }) });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.email, null);
  assert.equal(prisma.__db.emailOutbox.length, 0);
});
