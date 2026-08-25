"use client";

import { Button, Input, Select } from "@/components/ui";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownUp, ArrowRight, RefreshCw } from "lucide-react";

const CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "INR", name: "Indian Rupee" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "ZAR", name: "South African Rand" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "KRW", name: "Korean Won" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "THB", name: "Thai Baht" },
  { code: "TRY", name: "Turkish Lira" },
] as const;

const FEE_RATE = 0.005;
const COOLDOWN_S = 15;

const promises = [
  { label: "Tied to the invoice", sub: "The conversion should follow the Agreement, not a separate app." },
  { label: "The rate is the rate", sub: "No hidden FX markup. This preview uses ECB mid-market." },
  { label: "Built for client work", sub: "Designed around invoices and clients, not consumer cash pickup." },
] as const;

function formatAmount(value: number, currency: string) {
  if (!Number.isFinite(value)) return "-";
  const decimals = ["JPY", "KRW", "IDR"].includes(currency) ? 0 : 2;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

const amountInputClass =
  "h-auto min-h-0 min-w-0 w-0 flex-1 border-none bg-transparent px-0 py-0 text-left text-[1.75rem] font-bold leading-none tabular-nums tracking-tight text-slate-900 shadow-none outline-none ring-0 [appearance:textfield] placeholder:text-slate-300 hover:border-transparent focus-visible:border-transparent focus-visible:ring-0 dark:text-white sm:text-[2.15rem] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const currencySelectClass =
  "h-10 w-[4.75rem] shrink-0 cursor-pointer rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-bold tracking-wide text-slate-800 shadow-none hover:border-blue-200 focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-blue-800 dark:focus-visible:border-blue-500 dark:focus-visible:ring-blue-900/40";

export default function RemitSection() {
  const [fromCode, setFromCode] = useState("USD");
  const [toCode, setToCode] = useState("INR");
  const [amount, setAmount] = useState(1000);
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
    <section id="remit" data-testid="remit-section" className="relative scroll-mt-20 overflow-hidden bg-[#edf4ff] py-20 dark:bg-[#0b172b] sm:py-28">
      <div data-testid="remit-layout" className="relative mx-auto grid max-w-7xl min-w-0 items-start gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-14">
        <div data-testid="remit-story" className="flex min-w-0 max-w-xl flex-col">
          <h2
            className="text-4xl font-bold leading-[1.08] tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-[3.25rem]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Preview the conversion. Nothing moves yet.
          </h2>
          <p
            className="mt-5 max-w-[36ch] text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Remit is a preview next to the invoice. Live ECB rates here. No money moves yet.
          </p>

          <dl className="mt-8 divide-y divide-slate-200/80 dark:divide-white/10">
            {promises.map(({ label, sub }) => (
              <div data-testid="remit-promise" key={label} className="py-3.5 first:pt-0">
                <dt className="text-sm font-bold text-slate-950 dark:text-white" style={{ fontFamily: "var(--font-display)" }}>{label}</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400" style={{ fontFamily: "var(--font-body)" }}>{sub}</dd>
              </div>
            ))}
          </dl>

          <Link
            href="/roadmap"
            className="group mt-7 inline-flex w-fit items-center gap-2 text-sm font-bold text-blue-700 transition-transform duration-200 ease-[var(--ease-out)] hover:text-blue-800 active:scale-[0.98] dark:text-blue-300 dark:hover:text-blue-200"
            style={{ fontFamily: "var(--font-display)" }}
          >
            See the roadmap
            <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div data-testid="remit-calculator" className="relative min-w-0">
          <div className="relative min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_50px_rgb(12_30_54/0.10)] dark:border-white/10 dark:bg-slate-950 dark:shadow-none sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold tracking-tight text-slate-950 dark:text-white" style={{ fontFamily: "var(--font-display)" }}>
                  {fromCode} to {toCode}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400" style={{ fontFamily: "var(--font-body)" }}>
                  {ratesState === "error"
                    ? "Rates are temporarily unavailable. Try refresh."
                    : lastFetched
                      ? `ECB mid-market, updated ${ageLabel}`
                      : "Fetching live ECB rates"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={refresh}
                disabled={cooldown > 0 || ratesState === "loading"}
                title={cooldown > 0 ? `Refresh available in ${cooldown}s` : "Refresh rates"}
                className="h-9 shrink-0 gap-1.5 rounded-xl px-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-slate-200"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${ratesState === "loading" ? "animate-spin" : ""}`} />
                {cooldown > 0 ? `${cooldown}s` : "Refresh"}
              </Button>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-4 dark:bg-white/[0.04]">
              <label htmlFor="remit-send-amount" className="text-[11px] font-semibold text-slate-500 dark:text-slate-400" style={{ fontFamily: "var(--font-body)" }}>
                You send
              </label>
              <div className="mt-2 flex min-w-0 items-center gap-3">
                <Input
                  id="remit-send-amount"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
                  aria-label="Amount to send"
                  className={amountInputClass}
                  style={{ fontFamily: "var(--font-display)" }}
                />
                <Select
                  value={fromCode}
                  onChange={(event) => setFromCode(event.target.value)}
                  aria-label="Send currency"
                  className={currencySelectClass}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-3 px-1 py-3">
              <p className="min-w-0 flex-1 text-[12px] text-slate-500 dark:text-slate-400" style={{ fontFamily: "var(--font-body)" }}>
                0.5% illustrative fee: {formatAmount(fee, fromCode)} {fromCode}
              </p>
              <button
                type="button"
                onClick={swapCurrencies}
                aria-label={`Swap ${fromCode} and ${toCode}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-[transform,background-color,border-color] duration-200 ease-[var(--ease-out)] hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.97] dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/50"
              >
                <ArrowDownUp
                  className="h-4 w-4 motion-reduce:transition-none"
                  style={{
                    transform: swapped ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 200ms var(--ease-out)",
                  }}
                />
              </button>
            </div>

            <div className="rounded-2xl bg-blue-600 px-4 py-4 text-white dark:bg-blue-500">
              <p className="text-[11px] font-semibold text-blue-100" style={{ fontFamily: "var(--font-body)" }}>
                They receive
              </p>
              <div className="mt-2 flex min-w-0 items-center gap-3">
                <span
                  className={`min-w-0 flex-1 overflow-hidden text-ellipsis text-left text-[1.75rem] font-bold leading-none tabular-nums tracking-tight transition-opacity duration-200 ease-[var(--ease-out)] sm:text-[2.15rem] ${ratesState === "loading" ? "opacity-50" : "opacity-100"}`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {received === null ? "-" : formatAmount(received, toCode)}
                </span>
                <Select
                  value={toCode}
                  onChange={(event) => setToCode(event.target.value)}
                  aria-label="Receive currency"
                  className={currencySelectClass}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code} className="bg-white text-slate-900">
                      {currency.code}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-[12px] text-slate-500 dark:text-slate-400" style={{ fontFamily: "var(--font-body)" }}>
                {rate === null ? "Rate unavailable" : `1 ${fromCode} = ${formatAmount(rate, toCode)} ${toCode}`}
              </p>
              <p className="text-[12px] text-slate-400 dark:text-slate-500" style={{ fontFamily: "var(--font-body)" }}>
                Preview only. Not a transfer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
