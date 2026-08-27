"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownUp, CheckCircle2, ChevronDown, RefreshCw, Send } from "lucide-react";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";
import { cn } from "@/lib/utils";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD", "JPY", "CHF", "BRL", "HKD", "MXN", "ZAR", "CNY", "KRW", "MYR", "PHP", "IDR", "THB", "TRY"] as const;

const FEE_RATE = 0.005;
const COOLDOWN_S = 15;
const SEND_MS = 420;

const INVOICE = {
  number: "INV-1042",
  client: "Northstar Labs",
  project: "Product redesign",
} as const;

const DESTINATION = {
  name: "Maya Rao",
  bank: "HDFC",
  masked: "••4291",
} as const;

type Receipt = {
  fromCode: string;
  toCode: string;
  amount: number;
  converted: number;
  fee: number;
};

function formatAmount(value: number, currency: string) {
  if (!Number.isFinite(value)) return "-";
  const decimals = ["JPY", "KRW", "IDR"].includes(currency) ? 0 : 2;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

function CurrencySelect({
  value,
  onChange,
  disabled,
  label,
  variant = "default",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  variant?: "default" | "onPrimary";
}) {
  return (
    <div
      className={cn(
        "relative flex h-11 w-[5.5rem] shrink-0 items-center gap-1 rounded-xl border pl-2.5 pr-2 transition-colors duration-200 ease-rive-out",
        variant === "onPrimary"
          ? "border-white/25 bg-white/10 text-white hover:border-white/40"
          : "border-[var(--stroke-hairline)] bg-[var(--surface-raised)] text-foreground hover:border-primary/30",
        disabled && "opacity-60",
      )}
    >
      <span className="min-w-0 flex-1 text-sm font-bold leading-none tracking-wide">{value}</span>
      <ChevronDown aria-hidden="true" strokeWidth={2.25} className="h-3.5 w-3.5 shrink-0 opacity-80" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label={label}
        className="marketing-focus absolute inset-0 cursor-pointer appearance-none rounded-xl bg-transparent text-transparent disabled:cursor-not-allowed [&::-ms-expand]:hidden"
      >
        {CURRENCIES.map((code) => (
          <option key={code} value={code} className="bg-[var(--surface-raised)] text-foreground">{code}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Live FX conversion preview for Remit (in development). Fetches real ECB
 * mid-market rates and shows a sender amount, an illustrative fee, and the
 * receiver amount. Send is a vision of the payout composer — it never
 * moves money.
 */
export function RemitPreview() {
  const reduceMotion = useMarketingReducedMotion();
  const [fromCode, setFromCode] = useState("USD");
  const [toCode, setToCode] = useState("INR");
  const [amount, setAmount] = useState(2400);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesState, setRatesState] = useState<"idle" | "loading" | "error">("idle");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [ageSeconds, setAgeSeconds] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [phase, setPhase] = useState<"compose" | "sending" | "sent">("compose");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiptHeadingRef = useRef<HTMLHeadingElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

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
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    };
  }, [fetchRates]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (lastFetched) setAgeSeconds(Math.floor((Date.now() - lastFetched.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastFetched]);

  useEffect(() => {
    if (phase === "sent") receiptHeadingRef.current?.focus();
  }, [phase]);

  const rate = rates[fromCode] && rates[toCode] ? rates[toCode] / rates[fromCode] : null;
  const fee = amount * FEE_RATE;
  const converted = rate === null ? null : (amount - fee) * rate;
  const canSend = converted !== null && amount > 0 && ratesState !== "error" && phase !== "sending";

  const ageLabel = !lastFetched
    ? ""
    : ageSeconds < 5
      ? "just now"
      : ageSeconds < 60
        ? `${ageSeconds}s ago`
        : `${Math.floor(ageSeconds / 60)}m ago`;

  const refresh = () => {
    if (cooldown > 0 || ratesState === "loading" || phase !== "compose") return;
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
    if (phase !== "compose") return;
    setFromCode(toCode);
    setToCode(fromCode);
    setSwapped((value) => !value);
  };

  const sendPayout = () => {
    if (!canSend || converted === null) return;
    const snapshot: Receipt = { fromCode, toCode, amount, converted, fee };
    setReceipt(snapshot);
    if (reduceMotion) {
      setPhase("sent");
      return;
    }
    setPhase("sending");
    sendTimerRef.current = setTimeout(() => setPhase("sent"), SEND_MS);
  };

  const composeAnother = () => {
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    setPhase("compose");
    setReceipt(null);
    window.requestAnimationFrame(() => amountInputRef.current?.focus());
  };

  return (
    <div data-testid="remit-preview" className="min-w-0 rounded-2xl border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] p-5 shadow-card sm:p-6">
      {phase === "sent" && receipt ? (
        <div data-testid="remit-receipt" role="status" className="animate-remit-receipt-in">
          <p className="inline-flex items-center gap-1.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {INVOICE.number}
          </p>
          <h3 ref={receiptHeadingRef} tabIndex={-1} className="mt-2 text-lg font-black tracking-[-0.03em] text-foreground outline-none">
            Payout attached
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {INVOICE.client} · {INVOICE.project}
          </p>

          <div className="mt-5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-5 text-white shadow-[0_12px_35px_rgba(37,99,235,0.24)]">
            <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-blue-100">Receiver</p>
            <p className="mt-2 text-[1.75rem] font-black leading-none tabular-nums tracking-[-0.03em] sm:text-[2.1rem]">
              {formatAmount(receipt.converted, receipt.toCode)}{" "}
              <span className="text-base font-bold tracking-wide text-blue-100">{receipt.toCode}</span>
            </p>
          </div>

          <dl className="mt-5 divide-y divide-[color:var(--stroke-hairline)] border-y border-[var(--stroke-hairline)]">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-xs text-muted-foreground">Sender</dt>
              <dd className="text-sm font-bold tabular-nums text-foreground">{formatAmount(receipt.amount, receipt.fromCode)} {receipt.fromCode}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-xs text-muted-foreground">Fee</dt>
              <dd className="text-sm font-bold tabular-nums text-foreground">{formatAmount(receipt.fee, receipt.fromCode)} {receipt.fromCode}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-xs text-muted-foreground">Destination</dt>
              <dd className="text-right text-sm font-bold text-foreground">{DESTINATION.name} · {DESTINATION.bank} {DESTINATION.masked}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={composeAnother}
            className="marketing-focus mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--stroke-hairline)] bg-[var(--surface-glass)] px-5 text-sm font-bold text-foreground transition duration-200 ease-rive-out hover:-translate-y-0.5 hover:border-primary/25 hover:bg-foreground/[0.07]"
          >
            Compose another
          </button>
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{INVOICE.number}</p>
              <p className="mt-1 text-[15px] font-bold tracking-[-0.02em] text-foreground">{INVOICE.client}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {ratesState === "error"
                  ? "Rates are temporarily unavailable. Try refresh."
                  : lastFetched
                    ? `${fromCode} to ${toCode} · ECB mid-market, updated ${ageLabel}`
                    : "Fetching live ECB rates"}
              </p>
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={cooldown > 0 || ratesState === "loading" || phase === "sending"}
              title={cooldown > 0 ? `Refresh available in ${cooldown}s` : "Refresh rates"}
              className="marketing-focus inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-muted-foreground transition-colors duration-200 ease-rive-out hover:bg-[var(--surface-glass)] hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", ratesState === "loading" && "motion-safe:animate-spin")} aria-hidden="true" />
              {cooldown > 0 ? `${cooldown}s` : "Refresh"}
            </button>
          </div>

          <div className="rounded-2xl bg-[var(--surface-glass)] px-4 py-4">
            <label htmlFor="remit-sender-amount" className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Sender
            </label>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <input
                ref={amountInputRef}
                id="remit-sender-amount"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
                disabled={phase === "sending"}
                aria-label="Amount the sender pays"
                className="marketing-focus w-0 min-w-0 flex-1 border-none bg-transparent p-0 text-left text-[clamp(1.15rem,5.2vw,2.1rem)] font-black leading-none tabular-nums tracking-[-0.03em] text-foreground [appearance:textfield] placeholder:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-60"
              />
              <CurrencySelect value={fromCode} onChange={setFromCode} disabled={phase === "sending"} label="Sender currency" />
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3 px-1 py-3">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              0.5% illustrative fee: {formatAmount(fee, fromCode)} {fromCode}
            </p>
            <button
              type="button"
              onClick={swapCurrencies}
              disabled={phase === "sending"}
              aria-label={`Swap ${fromCode} and ${toCode}`}
              className="marketing-focus grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] text-muted-foreground transition-[transform,border-color,background-color] duration-200 ease-rive-out hover:border-primary/30 hover:bg-primary/10 hover:text-primary active:scale-[0.97] disabled:opacity-50"
            >
              <ArrowDownUp
                className="h-4 w-4 motion-reduce:transition-none"
                style={{ transform: swapped ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23, 1, 0.32, 1)" }}
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-4 text-white shadow-[0_12px_35px_rgba(37,99,235,0.24)]">
            <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-blue-100">Receiver</p>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "min-w-0 flex-1 text-left text-[clamp(1.15rem,5.2vw,2.1rem)] font-black leading-none tabular-nums tracking-[-0.03em] transition-opacity duration-200 ease-rive-out",
                  ratesState === "loading" ? "opacity-50" : "opacity-100",
                )}
              >
                {converted === null ? "-" : formatAmount(converted, toCode)}
              </span>
              <CurrencySelect value={toCode} onChange={setToCode} disabled={phase === "sending"} label="Receiver currency" variant="onPrimary" />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--stroke-hairline)] px-3.5 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Destination</p>
              <p className="mt-1 truncate text-sm font-bold tracking-[-0.02em] text-foreground">{DESTINATION.name} · {DESTINATION.bank} {DESTINATION.masked}</p>
            </div>
            <p className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{toCode}</p>
          </div>

          <button
            type="button"
            data-testid="remit-send"
            onClick={sendPayout}
            disabled={!canSend}
            aria-busy={phase === "sending"}
            aria-label={phase === "sending" ? "Sending payout" : `Send ${formatAmount(amount, fromCode)} ${fromCode} to ${DESTINATION.name}`}
            title={!canSend && ratesState === "error" ? "Rates unavailable" : undefined}
            className="marketing-focus mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 text-sm font-bold text-white shadow-[0_12px_35px_rgba(37,99,235,0.24)] transition-[transform,box-shadow,opacity] duration-200 ease-rive-out hover:-translate-y-0.5 hover:shadow-[0_16px_44px_rgba(37,99,235,0.34)] active:scale-[0.98] disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {phase === "sending" ? "Sending" : "Send"}
          </button>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-xs text-muted-foreground">{rate === null ? "Rate unavailable" : `1 ${fromCode} = ${formatAmount(rate, toCode)} ${toCode}`}</p>
            <p className="text-xs text-muted-foreground">Indicative conversion</p>
          </div>
        </>
      )}
    </div>
  );
}
