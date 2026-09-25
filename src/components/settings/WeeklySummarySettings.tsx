"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

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
    <div className="flex items-start justify-between gap-4 rounded-none border border-border bg-card p-4" data-testid="weekly-summary-settings">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-bold text-foreground">Weekly business summary</p>
          <p className="mt-0.5 max-w-md text-xs text-muted-foreground">
            A Monday morning email covering what was paid last week, what&apos;s outstanding, and what&apos;s coming up in the next 7 days. Off by default.
          </p>
          {lastSentAt && (
            <p className="mt-1 text-xs text-muted-foreground">Last sent {new Date(lastSentAt).toLocaleDateString()}.</p>
          )}
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Weekly business summary emails"
        disabled={loading || saving}
        onClick={() => toggle(!enabled)}
        className={`relative h-6 w-11 shrink-0 rounded-none border transition-colors disabled:opacity-55 ${enabled ? "border-primary bg-primary" : "border-border bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-none bg-card transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}
