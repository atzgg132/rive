"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StartEngagementComposer } from "@/components/engagements/StartEngagementComposer";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useFeatureAvailability } from "@/components/FeatureAvailabilityContext";

export default function StartEngagementPage() {
  const { displayCurrency } = useCurrency();
  const { agreements, engagementFlow } = useFeatureAvailability();
  if (!engagementFlow) {
    return <div className="workspace-page mx-auto max-w-xl rounded-2xl border border-border bg-card p-6"><h1 className="text-xl font-bold">Start engagement is not available here yet.</h1><p className="mt-2 text-sm text-muted-foreground">Use the existing client and project tools while this workflow is being rolled out.</p><Link href="/dashboard" className="mt-4 inline-flex text-sm font-bold text-primary hover:underline">Back to overview</Link></div>;
  }
  return (
    <div className="workspace-page mx-auto max-w-4xl animate-fade-in">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to overview
      </Link>
      <StartEngagementComposer entryPoint="workspace" currency={displayCurrency} agreementsAvailable={agreements} />
    </div>
  );
}
