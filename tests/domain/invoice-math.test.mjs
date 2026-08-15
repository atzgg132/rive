import assert from "node:assert/strict";
import test from "node:test";
import { calculateInvoice, decimalString } from "../../src/utils/invoiceMath.ts";

test("calculates invoice totals with decimal-safe line items and tax", () => {
  const result = calculateInvoice([
    { description: "Design sprint", quantity: "1.25", unitPrice: "99.99" },
    { description: "Support", quantity: "2", unitPrice: "0.10" },
  ], "18.5", "USD");

  assert.equal(decimalString(result.subtotal, "USD"), "125.19");
  assert.equal(decimalString(result.taxAmount, "USD"), "23.16");
  assert.equal(decimalString(result.total, "USD"), "148.35");
  assert.equal(result.items[0].quantity.toString(), "1.25");
  assert.equal(result.items[0].unitPrice.toString(), "99.99");
});

test("rounds zero-decimal currencies at the currency boundary", () => {
  const result = calculateInvoice([
    { description: "Workshop", quantity: "3", unitPrice: "100.6" },
  ], "0", "JPY");

  assert.equal(decimalString(result.subtotal, "JPY"), "302");
  assert.equal(decimalString(result.total, "JPY"), "302");
});

test("rejects invalid, negative, and zero-value invoice inputs", () => {
  assert.throws(() => calculateInvoice([], "0", "USD"), /at least one line item/);
  assert.throws(() => calculateInvoice([{ description: "Work", quantity: "-1", unitPrice: "10" }], "0", "USD"), /positive quantity/);
  assert.throws(() => calculateInvoice([{ description: "Work", quantity: "1", unitPrice: "10" }], "101", "USD"), /between 0 and 100/);
  assert.throws(() => calculateInvoice([{ description: "Work", quantity: "1", unitPrice: "0" }], "0", "USD"), /greater than zero/);
});

test("applies percentage discounts before tax with currency-safe rounding", () => {
  const result = calculateInvoice([
    { description: "Strategy", quantity: "1", unitPrice: "100" },
  ], "18", "USD", "10");

  assert.equal(decimalString(result.subtotal, "USD"), "100.00");
  assert.equal(decimalString(result.discountAmount, "USD"), "10.00");
  assert.equal(decimalString(result.taxAmount, "USD"), "16.20");
  assert.equal(decimalString(result.total, "USD"), "106.20");
});

test("rejects discounts outside the percentage range", () => {
  assert.throws(() => calculateInvoice([{ description: "Work", quantity: "1", unitPrice: "10" }], "0", "USD", "101"), /Discount rate must be between 0 and 100/);
});
