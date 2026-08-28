import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { prisma } from "../helpers/prisma-mock.mjs";
import { refreshOverdueInvoices } from "../../src/utils/invoiceLifecycle.ts";
import {
  STALE_SENDING_MS,
  hasIssuedInvoiceArtifact,
  isPublicInvoiceLinkAvailable,
  reclaimStaleSendingInvoice,
  recordPublicInvoiceView,
} from "../../src/utils/invoiceSend.ts";

beforeEach(() => {
  prisma.__reset();
});

function seedInvoice(data) {
  const record = {
    id: data.id || "inv-1",
    userId: data.userId || "user-1",
    status: data.status,
    sentSnapshot: data.sentSnapshot ?? null,
    sentAt: data.sentAt ?? null,
    viewedAt: data.viewedAt ?? null,
    publicTokenHash: data.publicTokenHash ?? "token-hash",
    sentSnapshotAt: data.sentSnapshotAt ?? null,
    dueDate: data.dueDate ?? null,
    createdAt: new Date(),
    updatedAt: data.updatedAt || new Date(),
  };
  prisma.__db.invoice.push(record);
  return record;
}

test("a sending invoice with a snapshot is a public link; without one it is not", () => {
  assert.equal(isPublicInvoiceLinkAvailable({ status: "sending", sentSnapshot: { total: "10" } }), true);
  assert.equal(isPublicInvoiceLinkAvailable({ status: "sending", sentSnapshot: null }), false);
  assert.equal(isPublicInvoiceLinkAvailable({ status: "draft", sentSnapshot: { total: "10" } }), false);
  assert.equal(isPublicInvoiceLinkAvailable({ status: "sent", sentSnapshot: { total: "10" } }), true);
});

test("first public view flips sent and sending to viewed, not overdue or partially_paid", async () => {
  seedInvoice({ id: "sent-inv", status: "sent", sentSnapshot: { total: "40" }, viewedAt: null });
  const sent = await recordPublicInvoiceView({ id: "sent-inv", status: "sent", viewedAt: null }, "ip-hash");
  assert.equal(sent.firstView, true);
  assert.equal(sent.status, "viewed");
  assert.equal(prisma.__db.invoice.find((row) => row.id === "sent-inv").status, "viewed");
  assert.ok(prisma.__db.invoice.find((row) => row.id === "sent-inv").viewedAt);
  assert.equal(prisma.__db.invoiceEvent.filter((event) => event.invoiceId === "sent-inv" && event.eventType === "viewed").length, 1);

  seedInvoice({ id: "overdue-inv", status: "overdue", sentSnapshot: { total: "40" }, viewedAt: null });
  const overdue = await recordPublicInvoiceView({ id: "overdue-inv", status: "overdue", viewedAt: null }, "ip-hash");
  assert.equal(overdue.status, "overdue");
  assert.ok(prisma.__db.invoice.find((row) => row.id === "overdue-inv").viewedAt);

  seedInvoice({ id: "partial-inv", status: "partially_paid", sentSnapshot: { total: "40" }, viewedAt: null });
  const partial = await recordPublicInvoiceView({ id: "partial-inv", status: "partially_paid", viewedAt: null }, "ip-hash");
  assert.equal(partial.status, "partially_paid");
});

test("concurrent first-view requests record one view event", async () => {
  seedInvoice({ id: "race-inv", status: "sent", sentSnapshot: { total: "40" }, viewedAt: null });
  const staleRequestSnapshot = { id: "race-inv", status: "sent", viewedAt: null };

  const first = await recordPublicInvoiceView(staleRequestSnapshot, "ip-one");
  const second = await recordPublicInvoiceView(staleRequestSnapshot, "ip-two");

  assert.equal(first.firstView, true);
  assert.equal(second.firstView, false);
  assert.equal(prisma.__db.invoiceEvent.filter((event) => event.invoiceId === "race-inv" && event.eventType === "viewed").length, 1);
});

test("stale sending with an unrecoverable plaintext token returns to a clean draft", async () => {
  const stale = new Date(Date.now() - STALE_SENDING_MS - 1_000);
  seedInvoice({
    id: "issued-sending",
    status: "sending",
    sentSnapshot: { total: "80" },
    sentAt: null,
    publicTokenHash: "keep-me",
    updatedAt: stale,
  });
  await reclaimStaleSendingInvoice("issued-sending", "user-1");
  const invoice = prisma.__db.invoice.find((row) => row.id === "issued-sending");
  assert.equal(invoice.status, "draft");
  assert.equal(invoice.publicTokenHash, null);
  assert.notDeepEqual(invoice.sentSnapshot, { total: "80" });
});

test("stale sending without a snapshot or sentAt returns to draft", async () => {
  const stale = new Date(Date.now() - STALE_SENDING_MS - 1_000);
  seedInvoice({
    id: "abandoned-sending",
    status: "sending",
    sentSnapshot: null,
    sentAt: null,
    publicTokenHash: "drop-me",
    updatedAt: stale,
  });
  await reclaimStaleSendingInvoice("abandoned-sending", "user-1");
  const invoice = prisma.__db.invoice.find((row) => row.id === "abandoned-sending");
  assert.equal(invoice.status, "draft");
  assert.equal(invoice.publicTokenHash, null);
});

test("fresh sending is left alone until it is stale", async () => {
  seedInvoice({
    id: "fresh-sending",
    status: "sending",
    sentSnapshot: { total: "12" },
    updatedAt: new Date(),
  });
  await reclaimStaleSendingInvoice("fresh-sending", "user-1");
  assert.equal(prisma.__db.invoice.find((row) => row.id === "fresh-sending").status, "sending");
});

test("lifecycle marks sent past due as overdue and leaves partially_paid", async () => {
  const past = new Date("2026-01-01T00:00:00.000Z");
  seedInvoice({ id: "open-sent", status: "sent", dueDate: past, sentSnapshot: { total: "10" } });
  seedInvoice({ id: "open-partial", status: "partially_paid", dueDate: past, sentSnapshot: { total: "10" } });
  const updated = await refreshOverdueInvoices("user-1");
  assert.equal(updated, 1);
  assert.equal(prisma.__db.invoice.find((row) => row.id === "open-sent").status, "overdue");
  assert.equal(prisma.__db.invoice.find((row) => row.id === "open-partial").status, "partially_paid");
});

test("hasIssuedInvoiceArtifact requires the immutable public snapshot", () => {
  assert.equal(hasIssuedInvoiceArtifact({ sentSnapshot: { total: "1" }, sentAt: null }), true);
  assert.equal(hasIssuedInvoiceArtifact({ sentSnapshot: null, sentAt: new Date() }), false);
  assert.equal(hasIssuedInvoiceArtifact({ sentSnapshot: null, sentAt: null }), false);
});
