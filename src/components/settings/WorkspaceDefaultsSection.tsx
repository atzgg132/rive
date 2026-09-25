"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Alert, Button, Select } from "@/components/ui";
import { DISPLAY_CURRENCIES } from "@/lib/currency";
import { isValidWorkspaceCurrency, workspaceCurrencyOptions } from "@/lib/settingsDomain";
import { supportedTimeZones } from "@/lib/calendar-time";

export type WorkspaceDefaultsData = { currency: string; timeZone: string };

export function WorkspaceDefaultsSection({ data }: { data: WorkspaceDefaultsData }) {
  const [currency, setCurrency] = useState(data.currency);
  const [timeZone, setTimeZone] = useState(data.timeZone);
  const [saving, setSaving] = useState(false);
  const timeZones = supportedTimeZones();
  if (!timeZones.includes(timeZone)) timeZones.unshift(timeZone);
  const common: string[] = DISPLAY_CURRENCIES.map((option) => option.code);
  const others = workspaceCurrencyOptions().filter((code) => !common.includes(code));
  if (!common.includes(currency) && !others.includes(currency)) others.unshift(currency);
  const currencyName = (code: string) => {
    try {
      return new Intl.DisplayNames(["en"], { type: "currency" }).of(code) || code;
    } catch {
      return code;
    }
  };
  const timeZoneChanged = timeZone !== data.timeZone;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidWorkspaceCurrency(currency)) { toast.error("Choose a currency from the list."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, timeZone }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Workspace defaults could not be saved.");
      toast.success("Workspace defaults saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workspace defaults could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="workspace" className="scroll-mt-24 rounded-none border border-border bg-card p-5">
      <h2 className="font-semibold">Workspace defaults</h2>
      <p className="mt-1 text-xs text-muted-foreground">The currency new projects, invoices, agreements, expenses, and imports use unless a linked project says otherwise. Your display currency (Preferences) is separate — it only changes how amounts are shown to you.</p>
      <form onSubmit={save} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted-foreground">Default currency<Select value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-2">
            <optgroup label="Common">{common.map((code) => <option key={code} value={code}>{code} — {currencyName(code)}</option>)}</optgroup>
            <optgroup label="All currencies">{others.map((code) => <option key={code} value={code}>{code} — {currencyName(code)}</option>)}</optgroup>
          </Select></label>
          <label className="text-xs font-semibold text-muted-foreground">Time zone<Select value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className="mt-2">{timeZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</Select></label>
        </div>
        {timeZoneChanged ? (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <div>Changing your time zone moves report month boundaries — revenue, expense, and activity totals for the current and upcoming month may shift.</div>
          </Alert>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save workspace defaults"}</Button>
        </div>
      </form>
    </section>
  );
}
