import "server-only";

import { convertWithUsdRates, type UsdExchangeRates } from "@/lib/currency";

interface FrankfurterResponse {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

export interface ExchangeRateSnapshot {
  asOf: string;
  rates: UsdExchangeRates;
}

export async function getExchangeRateSnapshot(): Promise<ExchangeRateSnapshot | null> {
  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD", {
      next: { revalidate: 60 * 60 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as FrankfurterResponse;
    if (payload.base !== "USD" || !payload.date || !payload.rates) return null;
    return { asOf: payload.date, rates: { USD: 1, ...payload.rates } };
  } catch {
    return null;
  }
}

export function convertFromSnapshot(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  snapshot: ExchangeRateSnapshot | null,
): number | null {
  return convertWithUsdRates(amount, fromCurrency, toCurrency, snapshot?.rates || null);
}
