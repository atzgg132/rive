"use client";

import { Globe2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/ui";
import { DISPLAY_CURRENCIES, type DisplayCurrency } from "@/lib/currency";
import { useCurrency } from "./CurrencyProvider";

export function CurrencySwitcher({ compact = false }: { compact?: boolean }) {
  const { displayCurrency, ratesAsOf, ratesStatus, saving, setDisplayCurrency } = useCurrency();

  const changeCurrency = async (value: string) => {
    try {
      await setDisplayCurrency(value as DisplayCurrency);
      toast.success(`Display currency saved as ${value}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save display currency.");
    }
  };

  return (
    <label
      className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-2.5 text-muted-foreground shadow-sm"
      title={ratesStatus === "ready" ? `Display currency · indicative rates dated ${ratesAsOf}` : "Display currency"}
    >
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe2 className="h-3.5 w-3.5" />}
      {!compact && <span className="text-xs font-medium">Display</span>}
      <Select
        aria-label="Display currency"
        value={displayCurrency}
        disabled={saving}
        onChange={(event) => void changeCurrency(event.target.value)}
        className={`${compact ? "w-20 min-w-20" : "w-40 min-w-40"} h-7 shrink-0 border-0 bg-transparent py-0 pl-1 pr-7 text-xs font-semibold text-foreground shadow-none [color-scheme:light] focus:ring-0 dark:[color-scheme:dark]`}
      >
        {DISPLAY_CURRENCIES.map(({ code, label }) => <option key={code} value={code} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">{code}{compact ? "" : ` · ${label}`}</option>)}
      </Select>
    </label>
  );
}
