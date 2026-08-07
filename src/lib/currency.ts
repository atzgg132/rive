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

export function formatMoney(amount: number, currency: string, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: currency.toUpperCase() === "JPY" ? 0 : 2,
  }).format(amount);
}
