"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownUp, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD", "JPY", "CHF", "BRL", "HKD", "MXN", "ZAR", "CNY", "KRW", "MYR", "PHP", "IDR", "THB", "TRY"] as const;

const FEE_RATE = 0.005;
const COOLDOWN_S = 15;

function formatAmount(value: number, currency: string) {
  if (!Number.isFinite(value)) return "-";
  const decimals = ["JPY", "KRW", "IDR"].includes(currency) ? 0 : 2;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

const selectClass =
  "marketing-focus h-10 w-[4.75rem] shrink-0 cursor-pointer rounded-xl border border-white/10 bg-[#101722] px-2 text-center text-sm font-bold tracking-wide text-slate-100 transition-colors duration-200 ease-rive-out hover:border-blue-300/30";

/**
 * Live payout preview for Remit (in development). Fetches real ECB mid-market
 * rates and shows send amount, illustrative fee, and the received amount.
 * Preview only: it never claims to move money.
 */
export function RemitPreview() {
  const [fromCode, setFromCode] = useState("USD");
  const [toCode, setToCode] = useState("INR");
  const [amount, setAmount] = useState(2400);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesState, setRatesState] = useState<"idle" | "loading" | "error">("idle");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [ageSeconds, setAgeSeconds] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRates = useCallback(async () => {
    setRatesState("loading");
    try {
      const response = await fetch("/api/rates", { cache: "no-store" });
      if (!response.ok) throw new Error("Rate request failed");
      const result = await response.json();
      if (!result.success) throw new Error("Rate proxy failed");
      setRates({ [result.data.base]: 1, ...result.data.rates });
      setLastFetched(new Date());
      setRatesState("idle");
    } catch {
      setRatesState("error");
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => void fetchRates(), 0);
    const interval = setInterval(() => void fetchRates(), 60_000);
    return () => {
      window.clearTimeout(initialFetch);
      clearInterval(interval);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [fetchRates]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (lastFetched) setAgeSeconds(Math.floor((Date.now() - lastFetched.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastFetched]);

  const rate = rates[fromCode] && rates[toCode] ? rates[toCode] / rates[fromCode] : null;
  const fee = amount * FEE_RATE;
  const received = rate === null ? null : (amount - fee) * rate;

  const ageLabel = !lastFetched
    ? ""
    : ageSeconds < 5
      ? "just now"
      : ageSeconds < 60
        ? `${ageSeconds}s ago`
        : `${Math.floor(ageSeconds / 60)}m ago`;

  const refresh = () => {
    if (cooldown > 0 || ratesState === "loading") return;
    void fetchRates();
    setCooldown(COOLDOWN_S);
    cooldownRef.current = setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  };

  const swapCurrencies = () => {
    setFromCode(toCode);
    setToCode(fromCode);
    setSwapped((value) => !value);
  };

  return (
    <div data-testid="remit-preview" className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#0a0e16] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold tracking-[-0.02em] text-white">{fromCode} to {toCode}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {ratesState === "error"
              ? "Rates are temporarily unavailable. Try refresh."
              : lastFetched
                ? `ECB mid-market, updated ${ageLabel}`
                : "Fetching live ECB rates"}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={cooldown > 0 || ratesState === "loading"}
          title={cooldown > 0 ? `Refresh available in ${cooldown}s` : "Refresh rates"}
          className="marketing-focus inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-slate-400 transition-colors duration-200 ease-rive-out hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", ratesState === "loading" && "motion-safe:animate-spin")} aria-hidden="true" />
          {cooldown > 0 ? `${cooldown}s` : "Refresh"}
        </button>
      </div>

      <div className="rounded-2xl bg-white/[0.04] px-4 py-4">
        <label htmlFor="remit-send-amount" className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
          You send
        </label>
        <div className="mt-2 flex min-w-0 items-center gap-3">
          <input
            id="remit-send-amount"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
            aria-label="Amount to send"
            className="marketing-focus w-0 flex-1 border-none bg-transparent p-0 text-left text-[1.75rem] font-black leading-none tabular-nums tracking-[-0.03em] text-white outline-none [appearance:textfield] placeholder:text-slate-600 sm:text-[2.1rem] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <select value={fromCode} onChange={(event) => setFromCode(event.target.value)} aria-label="Send currency" className={selectClass}>
            {CURRENCIES.map((code) => <option key={code} value={code} className="bg-[#101722] text-slate-100">{code}</option>)}
          </select>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-3 px-1 py-3">
        <p className="min-w-0 flex-1 text-xs text-slate-500">
          0.5% illustrative fee: {formatAmount(fee, fromCode)} {fromCode}
        </p>
        <button
          type="button"
          onClick={swapCurrencies}
          aria-label={`Swap ${fromCode} and ${toCode}`}
          className="marketing-focus grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-[#101722] text-slate-300 transition-[transform,border-color,background-color] duration-200 ease-rive-out hover:border-blue-300/30 hover:bg-[#101a2c] hover:text-blue-200 active:scale-[0.97]"
        >
          <ArrowDownUp
            className="h-4 w-4 motion-reduce:transition-none"
            style={{ transform: swapped ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23, 1, 0.32, 1)" }}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-4 text-white shadow-[0_12px_35px_rgba(37,99,235,0.24)]">
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-blue-100">They receive</p>
        <div className="mt-2 flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "min-w-0 flex-1 overflow-hidden text-ellipsis text-left text-[1.75rem] font-black leading-none tabular-nums tracking-[-0.03em] transition-opacity duration-200 ease-rive-out sm:text-[2.1rem]",
              ratesState === "loading" ? "opacity-50" : "opacity-100",
            )}
          >
            {received === null ? "-" : formatAmount(received, toCode)}
          </span>
          <select
            value={toCode}
            onChange={(event) => setToCode(event.target.value)}
            aria-label="Receive currency"
            className="marketing-focus h-10 w-[4.75rem] shrink-0 cursor-pointer rounded-xl border border-white/25 bg-white/10 px-2 text-center text-sm font-bold tracking-wide text-white transition-colors duration-200 ease-rive-out hover:border-white/40"
          >
            {CURRENCIES.map((code) => <option key={code} value={code} className="bg-[#101722] text-slate-100">{code}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs text-slate-500">{rate === null ? "Rate unavailable" : `1 ${fromCode} = ${formatAmount(rate, toCode)} ${toCode}`}</p>
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-slate-600">Preview only. Not a transfer.</p>
      </div>
    </div>
  );
}
