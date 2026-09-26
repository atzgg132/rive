"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui";

/**
 * Settings -> Notifications control for the opt-in weekly business summary
 * email. Loads and saves its own state against `/api/workflow/weekly-summary`.
 */
export function WeeklySummarySettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workflow/weekly-summary", { credentials: "same-origin", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load_failed"))))
      .then((data) => {
        if (cancelled) return;
        setEnabled(Boolean(data.enabled));
        setLastSentAt(data.lastSentAt || null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load weekly summary settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(next: boolean) {
    setSaving(true);
    setError(null);
    const previous = enabled;
    setEnabled(next);
    try {
      const response = await fetch("/api/workflow/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!response.ok) throw new Error("save_failed");
    } catch {
      setEnabled(previous);
      setError("Could not save that change. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3" data-testid="weekly-summary-settings">
      <div>
        <p className="text-sm font-semibold">Weekly business summary</p>
        <p className="text-xs text-muted-foreground">
          A Monday morning email: what was paid last week, what&apos;s outstanding, and what&apos;s coming up in the next 7 days.
        </p>
        {lastSentAt && <p className="mt-1 text-xs text-muted-foreground">Last sent {new Date(lastSentAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}.</p>}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={(value) => void toggle(Boolean(value))}
        disabled={loading || saving}
        aria-label="Weekly business summary emails"
      />
    </div>
  );
}
