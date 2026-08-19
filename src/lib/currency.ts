export const DISPLAY_CURRENCIES = [
  { code: "USD", label: "US dollar" },
  { code: "INR", label: "Indian rupee" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British pound" },
  { code: "AUD", label: "Australian dollar" },
  { code: "CAD", label: "Canadian dollar" },
  { code: "SGD", label: "Singapore dollar" },
  { code: "AED", label: "UAE dirham" },
  { code: "JPY", label: "Japanese yen" },
  { code: "CHF", label: "Swiss franc" },
  { code: "NZD", label: "New Zealand dollar" },
  { code: "CNY", label: "Chinese yuan" },
  { code: "HKD", label: "Hong Kong dollar" },
] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]["code"];
export type UsdExchangeRates = Record<string, number>;

const DISPLAY_CURRENCY_SET = new Set<string>(DISPLAY_CURRENCIES.map(({ code }) => code));

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === "string" && DISPLAY_CURRENCY_SET.has(value.toUpperCase());
}

export function normalizeCurrency(value: unknown, fallback: DisplayCurrency = "USD"): DisplayCurrency {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return isDisplayCurrency(normalized) ? normalized : fallback;
}

export function convertWithUsdRates(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: UsdExchangeRates | null,
): number | null {
  if (!Number.isFinite(amount)) return null;
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return amount;
  if (!rates) return null;
  const fromRate = from === "USD" ? 1 : rates[from];
  const toRate = to === "USD" ? 1 : rates[to];
  if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) return null;
  return amount * (toRate / fromRate);
}

const FALLBACK_LOCALE = "en-US";

// Digit grouping belongs to the money, not to whoever happens to be looking at
// it. Letting Intl resolve the runtime default meant the same stored amount
// rendered ₹60,56,458.23 to a reader whose browser reported en-IN and
// ₹6,056,458.23 to one reporting en-US — and because these views server-render
// before they hydrate, the Node process locale could disagree with the browser
// on the very first paint of the same page.
//
// So every currency is pinned to the locale of the market it belongs to,
// preferring that market's English locale where CLDR has one so the numerals
// read the way the rest of this English-language product does. INR is the case
// that carries real weight: lakh/crore grouping is what an Indian reader
// expects, and it is not something a US reader should be shown instead of.
const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  INR: "en-IN",
  EUR: "en-IE",
  GBP: "en-GB",
  AUD: "en-AU",
  CAD: "en-CA",
  SGD: "en-SG",
  AED: "en-AE",
  JPY: "en-JP",
  CHF: "en-CH",
  NZD: "en-NZ",
  CNY: "zh-CN",
  HKD: "en-HK",
};

/**
 * The locale a given currency is rendered in. Currencies outside the display
 * picker are still valid on projects and contracts, so an unknown code gets a
 * stable fallback rather than the reader's environment.
 */
export function localeForCurrency(currency: string): string {
  return CURRENCY_LOCALES[currency.trim().toUpperCase()] || FALLBACK_LOCALE;
}

/**
 * `locale` is an override for callers that have a better answer than the
 * currency does. Omitting it does not mean "ask the browser" — it means the
 * currency decides, so a bare call renders identically for every reader.
 */
export function formatMoney(amount: number, currency: string, locale?: string): string {
  const normalizedCurrency = currency.trim().toUpperCase() || "USD";
  const resolvedLocale = locale || localeForCurrency(normalizedCurrency);
  const maximumFractionDigits = normalizedCurrency === "JPY" ? 0 : 2;
  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: "currency",
      currency: normalizedCurrency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits,
    }).format(amount);
  } catch {
    // Project and contract currencies are intentionally extensible beyond the
    // display-currency picker. Keep an unknown three-letter code visible
    // instead of allowing Intl to take down a whole workspace view.
    try {
      return `${normalizedCurrency} ${new Intl.NumberFormat(resolvedLocale, { maximumFractionDigits }).format(amount)}`;
    } catch {
      // A caller-supplied locale Intl rejects must not take the view down either.
      return `${normalizedCurrency} ${new Intl.NumberFormat(FALLBACK_LOCALE, { maximumFractionDigits }).format(amount)}`;
    }
  }
}
