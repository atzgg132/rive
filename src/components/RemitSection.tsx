"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Globe, ArrowRight, Zap, Lock, Clock, Loader2,
  RefreshCw, TrendingUp,
} from "lucide-react";
import { submitToWaitlist } from "@/utils/api";

// ── Currency definitions (all supported by Frankfurter ECB) ──
const CURRENCIES = [
  { code: "USD", flag: "🇺🇸", name: "US Dollar"        },
  { code: "EUR", flag: "🇪🇺", name: "Euro"              },
  { code: "GBP", flag: "🇬🇧", name: "British Pound"     },
  { code: "INR", flag: "🇮🇳", name: "Indian Rupee"      },
  { code: "CAD", flag: "🇨🇦", name: "Canadian Dollar"   },
  { code: "AUD", flag: "🇦🇺", name: "Australian Dollar" },
  { code: "SGD", flag: "🇸🇬", name: "Singapore Dollar"  },
  { code: "JPY", flag: "🇯🇵", name: "Japanese Yen"      },
  { code: "CHF", flag: "🇨🇭", name: "Swiss Franc"       },
  { code: "BRL", flag: "🇧🇷", name: "Brazilian Real"    },
  { code: "HKD", flag: "🇭🇰", name: "Hong Kong Dollar"  },
  { code: "MXN", flag: "🇲🇽", name: "Mexican Peso"      },
  { code: "ZAR", flag: "🇿🇦", name: "South African Rand"},
  { code: "CNY", flag: "🇨🇳", name: "Chinese Yuan"      },
  { code: "KRW", flag: "🇰🇷", name: "Korean Won"        },
  { code: "MYR", flag: "🇲🇾", name: "Malaysian Ringgit" },
  { code: "PHP", flag: "🇵🇭", name: "Philippine Peso"   },
  { code: "IDR", flag: "🇮🇩", name: "Indonesian Rupiah" },
  { code: "THB", flag: "🇹🇭", name: "Thai Baht"         },
  { code: "TRY", flag: "🇹🇷", name: "Turkish Lira"      },
];

const FEE_RATE    = 0.005; // 0.5%
const COOLDOWN_S  = 15;    // seconds between refreshes
const FRANKFURTER = "/api/rates";

// Format numbers nicely
function fmt(n: number, code: string): string {
  if (!isFinite(n)) return "—";
  const decimals = ["JPY", "KRW", "IDR"].includes(code) ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export default function RemitSection() {
  const [email, setEmail]         = useState("");
  const [formState, setFormState] = useState<"idle"|"loading"|"success"|"already-joined">("idle");

  // Currency state
  const [fromCode, setFromCode] = useState("USD");
  const [toCode,   setToCode]   = useState("INR");
  const [amount,   setAmount]   = useState(1000);

  // Rates: { [currencyCode]: rate relative to base }
  const [rates,       setRates]       = useState<Record<string, number>>({});
  const [rateBase,    setRateBase]    = useState<string>("");
  const [ratesState,  setRatesState]  = useState<"idle"|"loading"|"error">("idle");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [cooldown,    setCooldown]    = useState(0);
  const cooldownRef  = useRef<NodeJS.Timeout | null>(null);
  const intervalRef  = useRef<NodeJS.Timeout | null>(null);

  // Fetch live rates from local API proxy
  const fetchRates = useCallback(async () => {
    setRatesState("loading");
    try {
      const res  = await fetch(FRANKFURTER);
      if (!res.ok) throw new Error("bad response");
      const result = await res.json();
      if (!result.success) throw new Error("Proxy error");
      const json = result.data;
      // Frankfurter returns rates relative to the `from` currency
      // Add the base itself as rate = 1
      const allRates: Record<string, number> = { [json.base]: 1, ...json.rates };
      setRates(allRates);
      setRateBase(json.base);
      setLastFetched(new Date());
      setRatesState("idle");
    } catch {
      setRatesState("error");
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchRates();
    // Auto-refresh every 60 seconds silently
    intervalRef.current = setInterval(fetchRates, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [fetchRates]);

  // Manual refresh — with 15s cooldown
  const handleRefresh = () => {
    if (cooldown > 0 || ratesState === "loading") return;
    fetchRates();
    setCooldown(COOLDOWN_S);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Compute the conversion
  const getRate = (from: string, to: string): number | null => {
    if (!rates[from] || !rates[to]) return null;
    // rates are all vs USD base. Convert: to / from
    return rates[to] / rates[from];
  };

  const rate       = getRate(fromCode, toCode);
  const feeAmount  = amount * FEE_RATE;
  const netAmount  = amount - feeAmount;
  const received   = rate !== null ? netAmount * rate : null;

  const fromCurrency = CURRENCIES.find(c => c.code === fromCode)!;
  const toCurrency   = CURRENCIES.find(c => c.code === toCode)!;

  // Seconds since last fetch
  const [ageSeconds, setAgeSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      if (lastFetched) setAgeSeconds(Math.floor((Date.now() - lastFetched.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastFetched]);

  const ageLabel = !lastFetched ? "" :
    ageSeconds < 5  ? "just now" :
    ageSeconds < 60 ? `${ageSeconds}s ago` :
    `${Math.floor(ageSeconds / 60)}m ago`;

  // Waitlist form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || formState === "loading") return;
    setFormState("loading");
    const res = await submitToWaitlist(email, "remit");
    setFormState(res.alreadyJoined ? "already-joined" : res.success ? "success" : "idle");
  };

  return (
    <section id="remit" className="relative bg-[#F5F8FC] py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-50/20 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-100/10 rounded-full blur-[130px]" />
      </div>
      <div
        className="absolute inset-0 opacity-[0.3] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, rgba(29,78,216,0.07) 1px, transparent 1px)", backgroundSize: "42px 42px" }}
      />

      <div className="max-w-7xl mx-auto px-8">
        <div className="grid lg:grid-cols-2 gap-20 items-center">

          {/* ── Left: Content ─────────────────────────── */}
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 w-fit">
              <Globe className="w-3 h-3 shrink-0" />
              <span style={{ fontFamily: "var(--font-body)" }}>coming soon — join the waitlist</span>
            </div>

            <h2 className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight leading-[1.08]" style={{ fontFamily: "var(--font-display)" }}>
              Remit{" "}
              <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">Payments</span>
              <br />
              <span className="text-3xl text-slate-500 font-medium">by rive.</span>
            </h2>

            <p className="text-slate-600 text-[1.05rem] leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
              Get paid internationally — fast, cheap, and without the headache. Remit is
              rive.&apos;s global payment layer, built specifically for freelancers crossing borders.
            </p>

            {/* Feature pills */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Zap,         label: "Instant Transfers",   sub: "Sub-second settlement"  },
                { icon: Lock,        label: "Bank-Grade Security",  sub: "256-bit encryption"     },
                { icon: TrendingUp,  label: "0.5% flat fee",        sub: "Best rate, always"      },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-slate-100 text-center shadow-sm shadow-blue-100/10">
                  <Icon className="w-5 h-5 text-blue-600" />
                  <p className="text-slate-800 text-xs font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{label}</p>
                  <p className="text-slate-400 text-[10px]" style={{ fontFamily: "var(--font-body)" }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Waitlist form */}
            {formState === "idle" || formState === "loading" ? (
              <form onSubmit={handleSubmit} className="flex gap-3 mt-2">
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required disabled={formState === "loading"}
                  className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500/50 transition-all duration-200 disabled:opacity-60"
                  style={{ fontFamily: "var(--font-body)" }}
                />
                <button type="submit" disabled={formState === "loading"}
                  className="group inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-semibold text-sm hover:from-blue-700 hover:to-sky-600 transition-all duration-200 shadow-lg shadow-blue-600/15 hover:-translate-y-px whitespace-nowrap shrink-0 disabled:opacity-75"
                  style={{ fontFamily: "var(--font-display)" }}>
                  {formState === "loading"
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>checking...</span></>
                    : <>Join Waitlist <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                  }
                </button>
              </form>
            ) : formState === "success" ? (
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 font-medium text-sm mt-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span style={{ fontFamily: "var(--font-body)" }}>you&apos;re on the Remit waitlist! check your inbox — we&apos;ve sent you a welcome email.</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 font-medium text-sm mt-2">
                <Clock className="w-4 h-4 shrink-0 text-blue-500" />
                <span style={{ fontFamily: "var(--font-body)" }}>already on the list — you&apos;ll be first to know when Remit launches.</span>
              </div>
            )}
          </div>

          {/* ── Right: Live currency widget ────────────── */}
          <div className="relative">
            <div className="relative p-7 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-200/40">

              {/* Widget header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-bold text-slate-800" style={{ fontFamily: "var(--font-display)" }}>remit calculator</p>
                  <p className="text-[11px] text-slate-400 mt-0.5" style={{ fontFamily: "var(--font-body)" }}>
                    {ratesState === "loading" ? (
                      <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> fetching rates...</span>
                    ) : ratesState === "error" ? (
                      <span className="text-red-400">rate fetch failed</span>
                    ) : lastFetched ? (
                      <span>live ECB rates · updated {ageLabel}</span>
                    ) : "—"}
                  </p>
                </div>
                {/* Refresh button */}
                <button
                  onClick={handleRefresh}
                  disabled={cooldown > 0 || ratesState === "loading"}
                  title={cooldown > 0 ? `refresh available in ${cooldown}s` : "refresh rates"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ratesState === "loading" ? "animate-spin" : ""}`} />
                  {cooldown > 0 ? `${cooldown}s` : "refresh"}
                </button>
              </div>

              {/* You send */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 mb-2">
                <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-widest font-bold" style={{ fontFamily: "var(--font-body)" }}>you send</p>
                <div className="flex items-center gap-3">
                  <select
                    value={fromCode}
                    onChange={e => setFromCode(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none cursor-pointer focus:border-blue-400 transition-all shrink-0"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input
                    type="number" min="1" step="any"
                    value={amount}
                    onChange={e => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="flex-1 bg-transparent text-right text-3xl font-bold text-slate-800 outline-none border-none w-0"
                    style={{ fontFamily: "var(--font-display)" }}
                  />
                </div>
              </div>

              {/* Fee row */}
              <div className="flex items-center justify-between px-4 py-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-px h-4 bg-blue-200" />
                  <span className="text-[11px] text-slate-400" style={{ fontFamily: "var(--font-body)" }}>
                    rive. fee (0.5%) — <span className="text-slate-600 font-semibold">{fromCurrency.flag} {fmt(feeAmount, fromCode)} {fromCode}</span>
                  </span>
                </div>
                <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full" style={{ fontFamily: "var(--font-body)" }}>
                  best rate ✓
                </span>
              </div>

              {/* Rate arrow */}
              <div className="flex items-center justify-center my-1">
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100/60 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-blue-600 rotate-90" />
                </div>
              </div>

              {/* They receive */}
              <div className="bg-blue-50/60 rounded-2xl border border-blue-100/50 p-4 mb-4">
                <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-widest font-bold" style={{ fontFamily: "var(--font-body)" }}>they receive</p>
                <div className="flex items-center gap-3">
                  <select
                    value={toCode}
                    onChange={e => setToCode(e.target.value)}
                    className="bg-white border border-blue-100 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none cursor-pointer focus:border-blue-400 transition-all shrink-0"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <span
                    className={`flex-1 text-right text-3xl font-bold text-blue-600 transition-all duration-300 ${ratesState === "loading" ? "opacity-40" : "opacity-100"}`}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {received !== null ? fmt(received, toCode) : "—"}
                  </span>
                </div>
              </div>

              {/* Live rate line */}
              {rate !== null && (
                <div className="flex items-center justify-between px-1 mb-4">
                  <span className="text-[11px] text-slate-400" style={{ fontFamily: "var(--font-body)" }}>
                    1 {fromCode} = {fmt(rate, toCode)} {toCode}
                  </span>
                  <span className="text-[11px] text-slate-400" style={{ fontFamily: "var(--font-body)" }}>
                    via ECB · ~30s settlement
                  </span>
                </div>
              )}

              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-px"
                style={{ fontFamily: "var(--font-display)" }}
              >
                coming soon — join waitlist
              </button>

              {/* Powered by */}
              <p className="text-center text-[10px] text-slate-300 mt-3" style={{ fontFamily: "var(--font-body)" }}>
                rates from European Central Bank · indicative only
              </p>
            </div>

            {/* Glow */}
            <div className="absolute inset-0 bg-blue-500/[0.02] rounded-3xl blur-2xl -z-10 scale-110 pointer-events-none" />
          </div>

        </div>
      </div>
    </section>
  );
}
