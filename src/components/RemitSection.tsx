"use client";

import { Button, Input, Select } from "@/components/ui";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Globe, Lock, Loader2, RefreshCw, TrendingUp, Zap } from "lucide-react";

const CURRENCIES = [
  ["USD", "US Dollar"], ["EUR", "Euro"], ["GBP", "British Pound"], ["INR", "Indian Rupee"],
  ["CAD", "Canadian Dollar"], ["AUD", "Australian Dollar"], ["SGD", "Singapore Dollar"], ["JPY", "Japanese Yen"],
  ["CHF", "Swiss Franc"], ["BRL", "Brazilian Real"], ["HKD", "Hong Kong Dollar"], ["MXN", "Mexican Peso"],
  ["ZAR", "South African Rand"], ["CNY", "Chinese Yuan"], ["KRW", "Korean Won"], ["MYR", "Malaysian Ringgit"],
  ["PHP", "Philippine Peso"], ["IDR", "Indonesian Rupiah"], ["THB", "Thai Baht"], ["TRY", "Turkish Lira"],
] as const;

const FEE_RATE = 0.005;

function formatAmount(value: number, currency: string) {
  const decimals = ["JPY", "KRW", "IDR"].includes(currency) ? 0 : 2;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

export default function RemitSection() {
  const [fromCode, setFromCode] = useState("USD");
  const [toCode, setToCode] = useState("INR");
  const [amount, setAmount] = useState(1000);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesState, setRatesState] = useState<"idle" | "loading" | "error">("idle");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [cooldown, setCooldown] = useState(0);
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

  const rate = rates[fromCode] && rates[toCode] ? rates[toCode] / rates[fromCode] : null;
  const fee = amount * FEE_RATE;
  const received = rate === null ? null : (amount - fee) * rate;
  const refresh = () => {
    if (cooldown > 0 || ratesState === "loading") return;
    void fetchRates();
    setCooldown(15);
    cooldownRef.current = setInterval(() => setCooldown((value) => {
      if (value <= 1) {
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        return 0;
      }
      return value - 1;
    }), 1000);
  };

  return (
    <section id="remit" data-testid="remit-section" className="relative scroll-mt-20 overflow-hidden bg-background py-20 dark:bg-background sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-blue-50/20 to-transparent" />
      <div data-testid="remit-layout" className="relative mx-auto grid max-w-7xl min-w-0 items-center gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div data-testid="remit-story" className="flex min-w-0 flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50/50 px-3.5 py-1.5 text-xs font-semibold text-blue-600"><Globe className="h-3 w-3" />Concept preview</div>
          <h2 className="text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">Remit <span className="text-blue-700 dark:text-blue-400">Payments</span><br /><span className="text-2xl font-medium text-slate-500 dark:text-slate-400 sm:text-3xl">By Rive.</span></h2>
          <p className="text-[1.05rem] leading-relaxed text-slate-600 dark:text-slate-300">Remit is our long-term direction for simpler international service payments. The calculator below is a rate preview, not a live transfer product.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[{ icon: Zap, label: "Faster payouts", sub: "Planned capability" }, { icon: Lock, label: "Secure by design", sub: "Core requirement" }, { icon: TrendingUp, label: "Clear pricing", sub: "No hidden markups" }].map(({ icon: Icon, label, sub }) => <div data-testid="remit-promise" key={label} className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-white p-4 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"><Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" /><p className="text-xs font-bold text-slate-800 dark:text-slate-200">{label}</p><p className="text-[10px] text-slate-400 dark:text-slate-500">{sub}</p></div>)}
          </div>
          <div className="mt-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center"><Link href="/register" className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 transition hover:-translate-y-px">Create a free account <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Link><span className="text-xs font-medium text-slate-400">Remit remains a future product direction.</span></div>
        </div>

        <div data-testid="remit-calculator" className="relative min-w-0 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Rate preview</p><p className="mt-1 text-xs text-slate-400">Indicative only · rates from ECB</p></div><Button type="button" variant="ghost" size="sm" onClick={refresh} disabled={cooldown > 0 || ratesState === "loading"} className="gap-1.5 text-xs text-slate-500"><RefreshCw className={`h-3.5 w-3.5 ${ratesState === "loading" ? "animate-spin" : ""}`} />{cooldown > 0 ? `${cooldown}s` : "Refresh"}</Button></div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2"><div className="min-w-0"><label className="text-xs font-bold text-slate-500">You send</label><div className="mt-1 flex min-w-0 gap-2"><Input type="number" min="0" value={amount} onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))} className="min-w-0 flex-1" /><Select value={fromCode} onChange={(event) => setFromCode(event.target.value)} className="min-w-0 flex-1">{CURRENCIES.map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}</Select></div></div><div className="min-w-0"><label className="text-xs font-bold text-slate-500">Recipient receives</label><div className="mt-1 flex min-w-0 gap-2"><Input readOnly value={received === null ? "—" : formatAmount(received, toCode)} className="min-w-0 flex-1" /><Select value={toCode} onChange={(event) => setToCode(event.target.value)} className="min-w-0 flex-1">{CURRENCIES.map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}</Select></div></div></div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60"><div className="flex justify-between text-xs text-slate-500"><span>Indicative rate</span><span>{rate === null ? "Unavailable" : `1 ${fromCode} = ${formatAmount(rate, toCode)} ${toCode}`}</span></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>Illustrative Rive fee</span><span>{formatAmount(fee, fromCode)} {fromCode}</span></div><div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm font-bold text-slate-800 dark:border-slate-700 dark:text-white"><span>Net amount</span><span>{formatAmount(Math.max(0, amount - fee), fromCode)} {fromCode}</span></div></div>
          {ratesState === "error" && <p className="mt-3 flex items-center gap-2 text-xs text-amber-600"><Loader2 className="h-3 w-3" />Rates are temporarily unavailable.</p>}
          <Link href="/register" className="mt-5 block w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-center text-sm font-bold text-white shadow-md transition hover:-translate-y-px hover:shadow-lg">Explore the free workspace</Link>
          <p className="mt-3 text-center text-[10px] text-slate-300">{lastFetched ? "Rates refreshed" : "Fetching rates..."}</p>
        </div>
      </div>
    </section>
  );
}
