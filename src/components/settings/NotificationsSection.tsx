"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui";
import { WeeklySummarySettings } from "@/components/settings/WeeklySummarySettings";

export function NotificationsSection({ loginAlertsEnabled }: { loginAlertsEnabled: boolean }) {
  const [enabled, setEnabled] = useState(loginAlertsEnabled);
  const [saving, setSaving] = useState(false);

  const toggle = async (next: boolean) => {
    setEnabled(next);
    setSaving(true);
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginAlertsEnabled: next }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Preference could not be saved.");
      toast.success(next ? "Login alert emails on." : "Login alert emails off.");
    } catch (error) {
      setEnabled(!next);
      toast.error(error instanceof Error ? error.message : "Preference could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="notifications" className="scroll-mt-24 rounded-none border border-border bg-card p-5">
      <h2 className="font-semibold">Notifications</h2>
      <p className="mt-1 text-xs text-muted-foreground">Emails rive. sends you about your account.</p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Login alert emails</p>
          <p className="text-xs text-muted-foreground">A note whenever your account is signed in to.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={(value) => void toggle(Boolean(value))} disabled={saving} aria-label="Login alert emails" />
      </div>
      <div className="mt-5">
        <WeeklySummarySettings />
      </div>
    </section>
  );
}
