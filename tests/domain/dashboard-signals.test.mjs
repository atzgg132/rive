import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeSignals,
  signalFromContractEvent,
  signalFromInquiry,
  signalFromInvoiceEvent,
} from "../../src/utils/signals.ts";

const invoice = { id: "inv-1", invoiceNumber: "INV-1042", currency: "USD", client: { name: "Acme" } };

test("a client opening an invoice is a signal; the invoice id deep-links to revenue", () => {
  const signal = signalFromInvoiceEvent({
    eventType: "viewed",
    createdAt: new Date("2026-08-05T09:12:00.000Z"),
    metadata: { ipHash: "abc" },
    invoice,
  });

  assert.equal(signal.kind, "invoice_viewed");
  assert.equal(signal.tone, "info");
  assert.equal(signal.title, "Acme opened INV-1042");
  assert.equal(signal.href, "/workflow/revenue?invoiceId=inv-1");
  assert.equal(signal.at, "2026-08-05T09:12:00.000Z");
});

test("payment events carry the amount from event metadata", () => {
  const partial = signalFromInvoiceEvent({
    eventType: "payment_recorded",
    createdAt: "2026-08-06T14:30:00.000Z",
    metadata: { amount: "600" },
    invoice,
  });
  const settled = signalFromInvoiceEvent({
    eventType: "paid",
    createdAt: "2026-08-06T14:30:00.000Z",
    metadata: { amount: "1350" },
    invoice,
  });

  assert.equal(partial.amount, 600);
  assert.equal(partial.tone, "success");
  assert.equal(settled.title, "INV-1042 paid in full");
});

test("a missing or malformed amount stays absent rather than rendering $NaN", () => {
  const signal = signalFromInvoiceEvent({
    eventType: "paid",
    createdAt: "2026-08-06T14:30:00.000Z",
    metadata: { amount: "not-a-number" },
    invoice,
  });
  assert.equal(signal.amount, null);

  const noMetadata = signalFromInvoiceEvent({ eventType: "paid", createdAt: "2026-08-06T14:30:00.000Z", metadata: null, invoice });
  assert.equal(noMetadata.amount, null);
});

test("events whose invoice no longer resolves produce nothing rather than a dead link", () => {
  const signal = signalFromInvoiceEvent({ eventType: "viewed", createdAt: "2026-08-05T00:00:00.000Z", invoice: null });
  assert.equal(signal, null);
});

test("the owner's own signature is not a signal — the client's is", () => {
  const ownerSigned = signalFromContractEvent({
    eventType: "signer_signed",
    createdAt: "2026-08-04T10:00:00.000Z",
    metadata: { role: "owner" },
    contract: { id: "c-1", title: "Acme retainer" },
  });
  const clientSigned = signalFromContractEvent({
    eventType: "signer_signed",
    createdAt: "2026-08-04T11:00:00.000Z",
    metadata: { role: "client" },
    contract: { id: "c-1", title: "Acme retainer" },
  });

  assert.equal(ownerSigned, null);
  assert.equal(clientSigned.kind, "contract_signed");
  assert.equal(clientSigned.href, "/workflow/contracts/c-1");
});

test("declines read as a warning worth opening, executed agreements as good news", () => {
  const declined = signalFromContractEvent({
    eventType: "signer_declined",
    createdAt: "2026-08-04T10:00:00.000Z",
    metadata: { role: "client" },
    contract: { id: "c-1", title: "Acme retainer" },
  });
  const executed = signalFromContractEvent({
    eventType: "contract_executed",
    createdAt: "2026-08-04T12:00:00.000Z",
    metadata: {},
    contract: { id: "c-1", title: "Acme retainer" },
  });

  assert.equal(declined.tone, "destructive");
  assert.equal(executed.tone, "success");
});

test("an enquiry links straight into the portfolio inbox", () => {
  const signal = signalFromInquiry({
    id: "inq-1",
    name: "Priyanka",
    projectType: "Brand design",
    sourceProjectTitle: "Northwind case study",
    createdAt: new Date("2026-08-03T08:00:00.000Z"),
  });

  assert.equal(signal.kind, "portfolio_inquiry");
  assert.equal(signal.title, "New enquiry from Priyanka");
  assert.equal(signal.detail, "While reading Northwind case study");
  assert.equal(signal.href, "/portfolio?tab=inquiries");
});

test("the merged feed is newest-first, bounded, and drops unmapped rows", () => {
  const events = [
    { eventType: "viewed", createdAt: "2026-08-05T00:00:00.000Z", invoice },
    { eventType: "paid", createdAt: "2026-08-06T00:00:00.000Z", metadata: { amount: "100" }, invoice },
    { eventType: "send_started", createdAt: "2026-08-07T00:00:00.000Z", invoice }, // self-action — not a signal
  ];

  const signals = mergeSignals(events.map(signalFromInvoiceEvent));
  assert.deepEqual(signals.map((signal) => signal.kind), ["invoice_paid", "invoice_viewed"]);

  const many = mergeSignals(
    Array.from({ length: 30 }, (_, index) =>
      signalFromInquiry({
        id: `inq-${index}`,
        name: `Visitor ${index}`,
        projectType: null,
        sourceProjectTitle: null,
        createdAt: new Date(Date.UTC(2026, 7, 1, index)),
      })),
    10,
  );
  assert.equal(many.length, 10);
  assert.equal(many[0].title, "New enquiry from Visitor 29");
});
