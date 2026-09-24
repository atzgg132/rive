"use client";

import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * A small, dismissable, one-time prompt for the opt-in weekly business
 * summary email (issue #66, PR 5) — never a modal, so it never competes with
 * `ActivationCard`'s guided-experience surface for attention. Eligibility
 * ("has this been shown before") is entirely server-side, via
 * `GET /api/workflow/weekly-summary/prompt`, so this component only needs to
 * render or not; it never re-derives the once-only rule itself.
 */
export function WeeklySummaryOptInCard() {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState<"enable" | "dismiss" | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workflow/weekly-summary/prompt", { credentials: "same-origin", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.available) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  async function respond(action: "dismiss" | "accepted") {
    setSaving(action === "accepted" ? "enable" : "dismiss");
    try {
      if (action === "accepted") {
        await fetch("/api/workflow/weekly-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true }),
        });
        setEnabled(true);
      }
      await fetch("/api/workflow/weekly-summary/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }).catch(() => undefined);
    } finally {
      if (action === "accepted") {
        setSaving(null);
      } else {
        setVisible(false);
        setSaving(null);
      }
    }
  }

  if (enabled) {
    return (
      <section
        role="status"
        data-testid="weekly-summary-optin-card"
        className="flex items-center gap-3 rounded-none border border-border bg-card p-4 text-sm text-foreground"
      >
        <Mail className="h-4 w-4 shrink-0 text-primary" />
        <p>Weekly summaries are on. Your first one arrives Monday morning.</p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Weekly summary opt-in"
      data-testid="weekly-summary-optin-card"
      className="flex flex-col gap-3 rounded-none border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-bold text-foreground">Want a Monday morning summary?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Paid last week, what&apos;s outstanding, and what&apos;s coming up — one short email, opt-in, unsubscribe any time.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => respond("dismiss")}
          disabled={saving !== null}
        >
          Not now
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => respond("accepted")}
          disabled={saving !== null}
        >
          {saving === "enable" ? "Turning on…" : "Turn on"}
        </Button>
      </div>
    </section>
  );
}
