"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  convertWithUsdRates,
  formatMoney,
  normalizeCurrency,
  type DisplayCurrency,
  type UsdExchangeRates,
} from "@/lib/currency";

type RatesStatus = "loading" | "ready" | "unavailable";

interface CurrencyContextValue {
  displayCurrency: DisplayCurrency;
  ratesAsOf: string | null;
  ratesStatus: RatesStatus;
  saving: boolean;
  convert: (amount: number, fromCurrency: string) => number | null;
  format: (amount: number, currency?: string) => string;
  formatConverted: (amount: number, fromCurrency: string) => string | null;
  setDisplayCurrency: (currency: DisplayCurrency) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  children,
  initialCurrency,
}: {
  children: React.ReactNode;
  initialCurrency?: string;
}) {
  const [displayCurrency, setDisplayCurrencyState] = useState<DisplayCurrency>(() => normalizeCurrency(initialCurrency));
  const [rates, setRates] = useState<UsdExchangeRates | null>(null);
  const [ratesAsOf, setRatesAsOf] = useState<string | null>(null);
  const [ratesStatus, setRatesStatus] = useState<RatesStatus>("loading");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/rates", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload.data?.rates) throw new Error("Rates unavailable");
        if (cancelled) return;
        setRates({ USD: 1, ...payload.data.rates });
        setRatesAsOf(payload.data.date || null);
        setRatesStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setRatesStatus("unavailable");
      });
    return () => { cancelled = true; };
  }, []);

  const convert = useCallback((amount: number, fromCurrency: string) => (
    convertWithUsdRates(amount, fromCurrency, displayCurrency, rates)
  ), [displayCurrency, rates]);

  const format = useCallback((amount: number, currency: string = displayCurrency) => (
    formatMoney(amount, currency)
  ), [displayCurrency]);

  const formatConverted = useCallback((amount: number, fromCurrency: string) => {
    const converted = convert(amount, fromCurrency);
    return converted === null ? null : formatMoney(converted, displayCurrency);
  }, [convert, displayCurrency]);

  const persistDisplayCurrency = useCallback(async (currency: DisplayCurrency) => {
    setSaving(true);
    try {
      const response = await fetch("/api/preferences/currency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayCurrency: currency }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Could not save display currency.");
      setDisplayCurrencyState(currency);
    } finally {
      setSaving(false);
    }
  }, []);

  const value = useMemo<CurrencyContextValue>(() => ({
    displayCurrency,
    ratesAsOf,
    ratesStatus,
    saving,
    convert,
    format,
    formatConverted,
    setDisplayCurrency: persistDisplayCurrency,
  }), [convert, displayCurrency, format, formatConverted, persistDisplayCurrency, ratesAsOf, ratesStatus, saving]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used inside CurrencyProvider.");
  return context;
}
