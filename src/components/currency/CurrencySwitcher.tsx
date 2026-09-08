"use client";

import { Check, Globe2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Select } from "@/components/ui";
import { DISPLAY_CURRENCIES, type DisplayCurrency } from "@/lib/currency";
import { useCurrency } from "./CurrencyProvider";

export function CurrencySwitcher({ compact = false }: { compact?: boolean }) {
  const { displayCurrency, displayCurrencySource, detectedCurrency, ratesAsOf, ratesStatus, saving, setDisplayCurrency, applyDetectedCurrency } = useCurrency();

  const changeCurrency = async (value: string) => {
    try {
      await setDisplayCurrency(value as DisplayCurrency);
      toast.success(`Display currency saved as ${value}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save display currency.");
    }
  };

  const canUseDetected = displayCurrencySource !== "user" && Boolean(detectedCurrency) && detectedCurrency !== displayCurrency;

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1">
      <label
        className="flex h-9 min-w-0 shrink-0 items-center gap-2 rounded-none border border-border bg-card px-2.5 text-muted-foreground"
        title={ratesStatus === "ready" ? `Display currency · indicative rates dated ${ratesAsOf}` : "Display currency"}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe2 className="h-3.5 w-3.5" />}
        {!compact && <span className="text-xs font-medium">Display</span>}
        <Select
          aria-label="Display currency"
          value={displayCurrency}
          disabled={saving}
          onChange={(event) => void changeCurrency(event.target.value)}
          className={`${compact ? "w-14 min-w-14" : "w-40 min-w-40"} h-7 shrink-0 border-0 bg-transparent py-0 pl-1 pr-7 text-xs font-semibold text-foreground shadow-none [color-scheme:light] focus:ring-0 dark:[color-scheme:dark]`}
        >
          {DISPLAY_CURRENCIES.map(({ code, label }) => <option key={code} value={code} className="bg-card text-card-foreground">{code}{compact ? "" : ` · ${label}`}</option>)}
        </Select>
      </label>
      {canUseDetected ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => void applyDetectedCurrency().then(() => toast.success(`Detected currency applied: ${detectedCurrency}.`)).catch((error) => toast.error(error instanceof Error ? error.message : "Could not apply detected currency."))}
          className={`${compact ? "w-8 px-0 max-[359px]:hidden" : "px-2"} h-9 shrink-0 text-[0.7rem] font-semibold text-primary hover:bg-primary/10`}
          title={`Use detected currency: ${detectedCurrency}`}
          aria-label={`Use detected currency: ${detectedCurrency}`}
        >
          {compact ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : `Use ${detectedCurrency}`}
        </Button>
      ) : null}
    </div>
  );
}
