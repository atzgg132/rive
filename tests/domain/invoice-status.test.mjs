import assert from "node:assert/strict";
import test from "node:test";

import { INVOICE_STATUSES } from "../../src/lib/domain-vocabulary.ts";
import {
  canRecordPayment,
  canSendInvoice,
  canVoidInvoice,
  invoiceEventLabel,
  invoiceStatusClass,
  invoiceStatusLabel,
  invoiceStatusTone,
} from "../../src/utils/invoiceStatus.ts";

test("the canonical vocabulary covers every status the API actually writes", () => {
  // The payment route writes partially_paid and the void route writes voided.
  // Both were absent, so migration validation rejected them and imported the
  // invoice as a draft instead.
  for (const status of ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "voided", "cancelled"]) {
    assert.ok(INVOICE_STATUSES.includes(status), `${status} missing from INVOICE_STATUSES`);
  }
});

test("every canonical status has a tone, a class, and a readable label", () => {
  for (const status of INVOICE_STATUSES) {
    assert.ok(invoiceStatusClass(status), `${status} has no class`);
    assert.notEqual(invoiceStatusLabel(status), "", `${status} has no label`);
    assert.ok(!invoiceStatusLabel(status).includes("_"), `${status} label leaks an underscore`);
  }
  assert.equal(invoiceStatusTone("partially_paid"), "open");
  assert.equal(invoiceStatusTone("voided"), "closed");
  assert.equal(invoiceStatusLabel("partially_paid"), "Partly paid");
});

test("an unknown status degrades instead of throwing", () => {
  assert.equal(invoiceStatusTone("who_knows"), "draft");
  assert.equal(invoiceStatusLabel("who_knows"), "who knows");
  assert.ok(invoiceStatusClass("who_knows"));
});

test("action guards mirror what the endpoints accept", () => {
  // Payment route: ["sent", "viewed", "overdue", "partially_paid"].
  assert.deepEqual(
    INVOICE_STATUSES.filter(canRecordPayment).sort(),
    ["overdue", "partially_paid", "sent", "viewed"],
  );
  // Send route is offered for drafts and overdue re-sends.
  assert.deepEqual(INVOICE_STATUSES.filter(canSendInvoice).sort(), ["draft", "overdue"]);
  // Void route: refuses anything closed, paid, or partly collected.
  assert.equal(canVoidInvoice("draft", 0), true);
  assert.equal(canVoidInvoice("overdue", 0), true);
  assert.equal(canVoidInvoice("draft", 250), false);
  assert.equal(canVoidInvoice("paid", 0), false);
  assert.equal(canVoidInvoice("partially_paid", 100), false);
  assert.equal(canVoidInvoice("voided", 0), false);
});

test("activity events read as sentences", () => {
  assert.equal(invoiceEventLabel("payment_recorded"), "Payment recorded");
  assert.equal(invoiceEventLabel("paid"), "Paid in full");
  assert.equal(invoiceEventLabel("something_new"), "something new");
});
