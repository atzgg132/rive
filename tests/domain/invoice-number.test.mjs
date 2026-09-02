import assert from "node:assert/strict";
import test from "node:test";

import { generatedInvoiceNumberSuffix } from "../../src/utils/invoiceNumber.ts";

test("generated invoice suffixes are recognized across prefixes and years", () => {
  assert.equal(generatedInvoiceNumberSuffix("INV-2026-0001"), 1);
  assert.equal(generatedInvoiceNumberSuffix("RIVE-2025-0042"), 42);
  assert.equal(generatedInvoiceNumberSuffix("My-Prefix-2030-123456789"), 123456789);
  assert.equal(generatedInvoiceNumberSuffix("INV-2026-2147483646"), 2147483646);
});

test("imported or user-entered formats do not move the generated sequence", () => {
  for (const value of [
    "INV-001",
    "IMPORT-file-2:row-4",
    "INV-26-0001",
    "INV-2026-0000",
    "INV-2026-2147483647",
  ]) {
    assert.equal(generatedInvoiceNumberSuffix(value), null, value);
  }
  assert.equal(generatedInvoiceNumberSuffix(" INV-2026-0007 "), 7);
});
