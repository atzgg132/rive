import assert from "node:assert/strict";
import test from "node:test";
import {
  convertWithUsdRates,
  formatMoney,
  inferCurrencyFromBrowser,
  inferCurrencyFromLocale,
  inferCurrencyFromRequest,
  localeForCurrency,
  normalizeCurrency,
  resolveDisplayCurrency,
} from "../../src/lib/currency.ts";

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

test("infers supported display currencies from locale regions", () => {
  assert.equal(inferCurrencyFromLocale("en-IN"), "INR");
  assert.equal(inferCurrencyFromLocale("de-DE"), "EUR");
  assert.equal(inferCurrencyFromLocale("ja_JP"), "JPY");
  assert.equal(inferCurrencyFromLocale("en-US;q=0.2,en-IN;q=0.9"), "INR");
  assert.equal(inferCurrencyFromLocale("es-MX"), null);
  assert.equal(inferCurrencyFromLocale("en"), null);
  assert.equal(inferCurrencyFromLocale("not a locale"), null);
});

test("uses Accept-Language and ignores untrusted proxy country headers", () => {
  const request = { headers: new Headers({ "x-vercel-ip-country": "IN", "accept-language": "en-US" }) };
  assert.equal(inferCurrencyFromRequest(request), "USD");
  assert.equal(inferCurrencyFromRequest({ headers: new Headers({ "accept-language": "en-GB,en;q=0.9" }) }), "GBP");
});

test("uses browser locale first and time zone as a fallback", () => {
  assert.equal(inferCurrencyFromBrowser("en-IN", "America/New_York"), "INR");
  assert.equal(inferCurrencyFromBrowser("en", "Asia/Kolkata"), "INR");
  assert.equal(inferCurrencyFromBrowser("en", "Etc/UTC"), null);
});

test("gives an explicit display preference precedence over detection", () => {
  assert.deepEqual(resolveDisplayCurrency({ explicit: " eur ", detected: "INR" }), { currency: "EUR", source: "user" });
  assert.deepEqual(resolveDisplayCurrency({ explicit: "unsupported", detected: "INR" }), { currency: "INR", source: "inferred" });
  assert.deepEqual(resolveDisplayCurrency({ fallback: "GBP" }), { currency: "GBP", source: "legacy" });
});

test("formats the selected currency rather than assuming dollars", () => {
  assert.match(formatMoney(1_234.5, "INR", "en-IN"), /1,234\.50/);
  assert.match(formatMoney(1_234, "JPY", "ja-JP"), /1,234/);
});

test("keeps an extensible project currency visible when Intl has no symbol", () => {
  assert.match(formatMoney(1_234.5, "XYZ", "en-US"), /^XYZ.*1,234\.5/);
});

// The grouping below is the whole point: no single runtime locale produces both
// of these. en-IN would group the dollar amount as $60,56,458.23 and en-US would
// group the rupee amount as INR 6,056,458.23, so this fails the moment
// formatMoney starts asking the environment instead of the currency again.
test("groups a total by its currency rather than by whoever is reading it", () => {
  assert.equal(formatMoney(6_056_458.23, "USD"), "$6,056,458.23");
  assert.equal(formatMoney(6_056_458.23, "INR"), "₹60,56,458.23");
});

test("pins every display currency to a locale, and unknown codes to a stable one", () => {
  assert.equal(localeForCurrency("INR"), "en-IN");
  assert.equal(localeForCurrency(" inr "), "en-IN");
  assert.equal(localeForCurrency("GBP"), "en-GB");
  assert.equal(localeForCurrency("XYZ"), "en-US");
});

test("lets a caller override the currency's locale, but never the environment", () => {
  assert.equal(formatMoney(6_056_458.23, "INR", "en-US"), "₹6,056,458.23");
  // An explicitly undefined locale is a bare call, not a request for the browser.
  assert.equal(formatMoney(6_056_458.23, "INR", undefined), formatMoney(6_056_458.23, "INR"));
});

test("survives a locale Intl rejects instead of taking the view down", () => {
  assert.ok(formatMoney(1_234.5, "USD", "not a locale").includes("1,234.5"));
});
