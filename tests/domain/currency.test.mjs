import assert from "node:assert/strict";
import test from "node:test";
import { convertWithUsdRates, formatMoney, normalizeCurrency } from "../../src/lib/currency.ts";

const rates = { USD: 1, EUR: 0.8, GBP: 0.5, INR: 80 };

test("converts through the common USD reference without mixing nominal values", () => {
  assert.equal(convertWithUsdRates(100, "USD", "INR", rates), 8_000);
  assert.equal(convertWithUsdRates(8_000, "INR", "USD", rates), 100);
  assert.equal(convertWithUsdRates(100, "EUR", "GBP", rates), 62.5);
});

test("preserves same-currency values even when the rate service is unavailable", () => {
  assert.equal(convertWithUsdRates(125.25, "INR", "INR", null), 125.25);
});

test("refuses to invent a conversion when either rate is unavailable", () => {
  assert.equal(convertWithUsdRates(100, "BRL", "INR", rates), null);
  assert.equal(convertWithUsdRates(100, "USD", "BRL", rates), null);
});

test("normalizes supported preferences and falls back safely", () => {
  assert.equal(normalizeCurrency(" inr "), "INR");
  assert.equal(normalizeCurrency("XYZ"), "USD");
});

test("formats the selected currency rather than assuming dollars", () => {
  assert.match(formatMoney(1_234.5, "INR", "en-IN"), /1,234\.50/);
  assert.match(formatMoney(1_234, "JPY", "ja-JP"), /1,234/);
});
