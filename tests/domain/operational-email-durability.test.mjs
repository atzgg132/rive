import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contractSignRoute = await readFile(
  new URL("../../src/app/api/public/contracts/sign/[token]/route.ts", import.meta.url),
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
  assert.match(retryRoute, /status: "failed"/);
  assert.match(retryRoute, /processEmailOutbox\(\{ jobId: delivery\.id \}\)/);
});
