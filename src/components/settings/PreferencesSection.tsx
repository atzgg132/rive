"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { CurrencySwitcher } from "@/components/currency/CurrencySwitcher";
import { Button } from "@/components/ui";
import { openHelpFromMobileShell } from "@/components/dashboard/GuidedExperience";

export function PreferencesSection() {
  return (
    <section id="preferences" className="scroll-mt-24 rounded-none border border-border bg-card p-5">
      <h2 className="font-semibold">Preferences</h2>
      <p className="mt-1 text-xs text-muted-foreground">Personal display choices — these don't change what anyone else sees.</p>
      <div className="mt-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-sm font-semibold">Display currency</p>
            <p className="text-xs text-muted-foreground">How amounts are shown to you. This never changes the currency a record is actually saved in.</p>
          </div>
          <CurrencySwitcher />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-sm font-semibold">Theme</p>
            <p className="text-xs text-muted-foreground">Light, dark, or match your system.</p>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Guided tour</p>
            <p className="text-xs text-muted-foreground">Replay the walkthrough for any part of rive.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => openHelpFromMobileShell()}>Replay guided tour</Button>
        </div>
      </div>
    </section>
  );
}
