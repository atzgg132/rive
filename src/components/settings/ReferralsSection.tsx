"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { REFERRAL_CREDIT_CAP_MONTHS, referralLink } from "@/lib/referrals";

type ReferralSummary = {
  code: string;
  joined: number;
  activated: number;
  monthsEarned: number;
  monthsCap: number;
  referredBy: { activated: boolean; months: number } | null;
};

/**
 * Settings -> Referrals: the user's personal link and the launch credit it has
 * earned. Loads its own state so the rest of Settings does not wait on the
 * activation check behind these numbers.
 */
export function ReferralsSection() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/referrals", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        if (!payload?.success) throw new Error(payload?.message || "Referrals could not be loaded.");
        setSummary(payload.referrals);
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Referrals could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

  const link = summary ? referralLink(window.location.origin, summary.code) : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(link).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section id="referrals" className="scroll-mt-24 rounded-none border border-border bg-card p-5">
      <h2 className="font-semibold">Referrals</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        rive. is free during open beta. For each person who joins through your link and activates, you earn one free month once paid plans launch, up to {REFERRAL_CREDIT_CAP_MONTHS} months. They get a free month too.
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {!summary && !error && <p className="mt-4 text-sm text-muted-foreground">Loading referrals…</p>}
      {summary && (
        <>
          <div className="mt-5 flex gap-2">
            <Input readOnly value={link} aria-label="Your referral link" className="min-w-0 flex-1 font-mono text-xs" />
            <Button variant="outline" size="sm" onClick={() => void copyLink()} className="px-3" aria-label={copied ? "Referral link copied" : "Copy referral link"}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Joined</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums" data-testid="referrals-joined">{summary.joined}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Activated</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums" data-testid="referrals-activated">{summary.activated}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Free months earned</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums" data-testid="referrals-months">{summary.monthsEarned} of {summary.monthsCap}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            A referral activates when the new account sets up real work in its first seven days, such as a client with a project. Credit is applied when paid plans launch.
          </p>
          {summary.referredBy && (
            <p className="mt-3 text-xs text-muted-foreground" data-testid="referrals-own-credit">
              {summary.referredBy.activated
                ? "You joined through a referral and earned 1 free month for when paid plans launch."
                : "You joined through a referral. Set up real work in your first seven days to earn 1 free month for when paid plans launch."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
