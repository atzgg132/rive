"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StartEngagementComposer, type StartEngagementInquiry } from "@/components/engagements/StartEngagementComposer";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useFeatureAvailability } from "@/components/FeatureAvailabilityContext";

export default function StartEngagementPage() {
  const { displayCurrency } = useCurrency();
  const { agreements, engagementFlow } = useFeatureAvailability();
  const [inquiryId] = useState(() => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("inquiryId"));
  const [inquiry, setInquiry] = useState<StartEngagementInquiry | null>(null);
  const [inquiryLoading, setInquiryLoading] = useState(Boolean(inquiryId));
  const [inquiryError, setInquiryError] = useState("");

  useEffect(() => {
    if (!inquiryId) return;
    let cancelled = false;
    void fetch(`/api/portfolio/inquiries/${encodeURIComponent(inquiryId)}`, { cache: "no-store" })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok || !data?.success) throw new Error(data?.message || "This enquiry could not be loaded.");
        const detail = data.inquiry;
        if (!detail?.convertedAt || !detail.convertedClient) throw new Error("Convert this enquiry to a Client before starting the engagement.");
        if (!cancelled) {
          setInquiry({
            id: detail.id,
            name: detail.name,
            email: detail.email,
            projectType: detail.projectType,
            message: detail.message,
            convertedClient: detail.convertedClient,
          });
        }
      })
      .catch((error) => { if (!cancelled) setInquiryError(error instanceof Error ? error.message : "This enquiry could not be loaded."); })
      .finally(() => { if (!cancelled) setInquiryLoading(false); });
    return () => { cancelled = true; };
  }, [inquiryId]);

  if (!engagementFlow) {
    return <div className="workspace-page mx-auto max-w-xl rounded-2xl border border-border bg-card p-6"><h1 className="text-xl font-bold">Start engagement is not available here yet.</h1><p className="mt-2 text-sm text-muted-foreground">Use the existing client and project tools while this workflow is being rolled out.</p><Link href="/dashboard" className="mt-4 inline-flex text-sm font-bold text-primary hover:underline">Back to overview</Link></div>;
  }
  return (
    <div className="workspace-page mx-auto max-w-4xl animate-fade-in">
      <Link href={inquiryId ? "/portfolio" : "/dashboard"} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {inquiryId ? "Back to portfolio" : "Back to overview"}
      </Link>
      {inquiryId && inquiryLoading ? (
        <div className="rounded-3xl border border-border bg-card p-7 text-sm text-muted-foreground">Loading the converted enquiry…</div>
      ) : inquiryId && inquiryError ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-7"><h1 className="text-xl font-black text-destructive">Start Engagement is not ready</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{inquiryError}</p><Link href="/portfolio" className="mt-4 inline-flex text-sm font-bold text-primary hover:underline">Return to enquiries</Link></div>
      ) : inquiryId && inquiry ? (
        <StartEngagementComposer entryPoint="inquiry" inquiry={inquiry} currency={displayCurrency} agreementsAvailable={agreements} />
      ) : (
        <StartEngagementComposer entryPoint="workspace" currency={displayCurrency} agreementsAvailable={agreements} />
      )}
    </div>
  );
}
