"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  convertWithUsdRates,
  formatMoney,
  inferCurrencyFromBrowser,
  normalizeCurrency,
  type DisplayCurrency,
  type DisplayCurrencySource,
  type UsdExchangeRates,
} from "@/lib/currency";

type RatesStatus = "loading" | "ready" | "unavailable";

interface CurrencyContextValue {
  displayCurrency: DisplayCurrency;
  ratesAsOf: string | null;
  ratesStatus: RatesStatus;
  saving: boolean;
  displayCurrencySource: DisplayCurrencySource;
  detectedCurrency: DisplayCurrency | null;
  convert: (amount: number, fromCurrency: string) => number | null;
  format: (amount: number, currency?: string) => string;
  formatConverted: (amount: number, fromCurrency: string) => string | null;
  setDisplayCurrency: (currency: DisplayCurrency) => Promise<void>;
  applyDetectedCurrency: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  children,
  initialCurrency,
  initialSource,
}: {
  children: React.ReactNode;
  initialCurrency?: string;
  initialSource?: string;
}) {
  const [displayCurrency, setDisplayCurrencyState] = useState<DisplayCurrency>(() => normalizeCurrency(initialCurrency));
  const [displayCurrencySource, setDisplayCurrencySource] = useState<DisplayCurrencySource>(() => (
    initialSource === "user" || initialSource === "inferred" || initialSource === "legacy" ? initialSource : "legacy"
  ));
  const [detectedCurrency, setDetectedCurrency] = useState<DisplayCurrency | null>(null);
  const [rates, setRates] = useState<UsdExchangeRates | null>(null);
  const [ratesAsOf, setRatesAsOf] = useState<string | null>(null);
  const [ratesStatus, setRatesStatus] = useState<RatesStatus>("loading");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetectedCurrency(inferCurrencyFromBrowser(navigator.language, timeZone));
  }, []);

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

  const persistDisplayCurrency = useCallback(async (currency: DisplayCurrency, selection: "explicit" | "detected" = "explicit") => {
    setSaving(true);
    try {
      const response = await fetch("/api/preferences/currency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayCurrency: currency, selection }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Could not save display currency.");
      setDisplayCurrencyState(currency);
      setDisplayCurrencySource(payload.displayCurrencySource === "inferred" ? "inferred" : "user");
    } finally {
      setSaving(false);
    }
  }, []);

  const applyDetectedCurrency = useCallback(async () => {
    if (!detectedCurrency || detectedCurrency === displayCurrency) return;
    await persistDisplayCurrency(detectedCurrency, "detected");
  }, [detectedCurrency, displayCurrency, persistDisplayCurrency]);

  const value = useMemo<CurrencyContextValue>(() => ({
    displayCurrency,
    displayCurrencySource,
    detectedCurrency,
    ratesAsOf,
    ratesStatus,
    saving,
    convert,
    format,
    formatConverted,
    setDisplayCurrency: persistDisplayCurrency,
    applyDetectedCurrency,
  }), [applyDetectedCurrency, convert, detectedCurrency, displayCurrency, displayCurrencySource, format, formatConverted, persistDisplayCurrency, ratesAsOf, ratesStatus, saving]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used inside CurrencyProvider.");
  return context;
}
