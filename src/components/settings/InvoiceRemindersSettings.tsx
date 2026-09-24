"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Switch } from "@/components/ui";
import { INVOICE_REMINDER_STEPS, type InvoiceReminderStep } from "@/lib/domain-vocabulary";

const STEP_LABELS: Record<InvoiceReminderStep, string> = {
  due_minus_3: "3 days before due",
  due_plus_1: "1 day after due",
  due_plus_7: "7 days after due",
  due_plus_14: "14 days after due",
};

type Settings = {
  remindersEnabled: boolean;
  reminderSchedule: string[];
  paidReceiptEnabled: boolean;
};

/**
 * Self-contained invoice reminders & receipts settings (#66 PR 2).
 *
 * Deliberately standalone — the Business & invoicing settings page that will
 * host this (PR 1, `feature/settings-page`) has not landed yet. This
 * component takes no required props: it loads and saves its own state so it
 * can be mounted into that page's layout later with no wiring beyond
 * `<InvoiceRemindersSettings />`.
 */
export default function InvoiceRemindersSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/workflow/invoice-reminders/settings", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!cancelled && response.ok && data?.success) setSettings(data.settings);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (patch: Partial<Settings>) => {
    if (!settings) return;
    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      const response = await fetch("/api/workflow/invoice-reminders/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Setting could not be saved.");
      setSettings(data.settings);
    } catch (err) {
      setSettings(previous);
      toast.error(err instanceof Error ? err.message : "Setting could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStep = (step: string) => {
    if (!settings) return;
    const has = settings.reminderSchedule.includes(step);
    const next = has ? settings.reminderSchedule.filter((entry) => entry !== step) : [...settings.reminderSchedule, step];
    void save({ reminderSchedule: next });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading invoice reminder settings…
      </div>
    );
  }
  if (!settings) {
    return <p className="p-4 text-sm text-destructive">Invoice reminder settings could not be loaded.</p>;
  }

  return (
    <div className="flex flex-col gap-6 rounded-none border border-border bg-card p-5">
      <div>
        <h3 className="text-sm font-bold">Invoice reminders</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Automatically email clients about unpaid invoices, up to 4 reminders per invoice. Off by default. Clients can opt out from any reminder email.
        </p>
      </div>

      <label className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Send reminders</p>
          <p className="text-xs text-muted-foreground">Applies to invoices with a due date that are sent and unpaid.</p>
        </div>
        <Switch
          aria-label="Send invoice reminders"
          checked={settings.remindersEnabled}
          onCheckedChange={(checked) => void save({ remindersEnabled: checked })}
          disabled={saving}
        />
      </label>

      {settings.remindersEnabled ? (
        <fieldset className="flex flex-col gap-2 border-t border-border pt-4">
          <legend className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Schedule</legend>
          {INVOICE_REMINDER_STEPS.map((step) => (
            <label key={step} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.reminderSchedule.includes(step)}
                onChange={() => toggleStep(step)}
                disabled={saving}
                className="h-4 w-4 rounded-none border-border accent-primary"
              />
              {STEP_LABELS[step]}
            </label>
          ))}
        </fieldset>
      ) : null}

      <label className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <div>
          <p className="text-sm font-semibold">Send paid receipts</p>
          <p className="text-xs text-muted-foreground">Email the client a receipt automatically once an invoice is paid in full.</p>
        </div>
        <Switch
          aria-label="Send paid receipts"
          checked={settings.paidReceiptEnabled}
          onCheckedChange={(checked) => void save({ paidReceiptEnabled: checked })}
          disabled={saving}
        />
      </label>

      {saving ? <Button size="sm" variant="ghost" disabled className="w-fit gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</Button> : null}
    </div>
  );
}
