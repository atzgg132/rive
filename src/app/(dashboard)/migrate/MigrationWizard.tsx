"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/ui";
import UploadStep from "./steps/UploadStep";
import AnalysisStep from "./steps/AnalysisStep";
import ReviewStep from "./steps/ReviewStep";
import PlanStep from "./steps/PlanStep";
import SuccessStep from "./steps/SuccessStep";
import MigrationHistory from "./MigrationHistory";
import type { MigrationDetail, MigrationLimits } from "./types";

type Step = "upload" | "analyzing" | "found" | "review" | "plan" | "done";

/**
 * The migration wizard.
 *
 * All migration state lives on the server. This component holds only which
 * screen is showing and whether a request is in flight, which is what makes a
 * refresh — or continuing on another device — pick up exactly where the user
 * left off.
 */
export default function MigrationWizard({ limits }: { limits: MigrationLimits }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("id");

  const [migrationId, setMigrationId] = useState<string | null>(resumeId);
  const [detail, setDetail] = useState<MigrationDetail | null>(null);
  const [step, setStep] = useState<Step>(resumeId ? "analyzing" : "upload");
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<{ created: Record<string, number>; linked: number; skipped: number; total: number } | null>(null);

  const load = useCallback(
    async (id: string, filter = "issues", page = 0) => {
      const response = await fetch(`/api/migrations/${id}?filter=${filter}&page=${page}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "This migration could not be opened.");
      setDetail(data as MigrationDetail);
      return data as MigrationDetail;
    },
    [],
  );

  // Resuming an in-progress migration: the server decides which screen is
  // correct from the persisted state, not the browser.
  useEffect(() => {
    if (!resumeId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await load(resumeId);
        if (cancelled) return;
        setMigrationId(resumeId);
        setStep(stepForState(data));
      } catch (error) {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : "This migration could not be opened.");
        setStep("upload");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeId, load]);

  async function handleUpload(files: File[], defaultCurrency: string) {
    setBusy(true);
    setStep("analyzing");
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      if (defaultCurrency) form.set("defaultCurrency", defaultCurrency);

      const response = await fetch("/api/migrations", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "These files could not be read.");

      for (const warning of data.warnings || []) toast.info(warning);

      setMigrationId(data.migrationId);
      // Keep the id in the URL so a refresh resumes rather than restarts.
      router.replace(`/migrate?id=${data.migrationId}`, { scroll: false });
      const loaded = await load(data.migrationId);
      setStep(loaded.plan && loaded.plan.totals.create + loaded.plan.totals.link > 0 ? "found" : "review");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "These files could not be read.");
      setStep("upload");
    } finally {
      setBusy(false);
    }
  }

  const refresh = useCallback(
    async (filter?: string, page?: number) => {
      if (!migrationId) return null;
      return load(migrationId, filter, page);
    },
    [migrationId, load],
  );

  async function patch(body: Record<string, unknown>) {
    if (!migrationId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/migrations/${migrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "That change could not be saved.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!migrationId || !detail?.plan) return;
    setCommitting(true);
    try {
      const response = await fetch(`/api/migrations/${migrationId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The plan the user was shown is the plan that runs.
        body: JSON.stringify({ planHash: detail.plan.planHash }),
      });
      const data = await response.json();

      if (response.status === 409) {
        toast.error(data.message || "This migration changed. Review it again.");
        await refresh();
        setStep("review");
        return;
      }
      if (!response.ok) {
        toast.error(data.message || "The import stopped partway.");
        await refresh();
        setStep("plan");
        return;
      }

      setResult({ created: data.created, linked: data.linked, skipped: data.skipped, total: data.total });
      setStep("done");
    } catch {
      toast.error("The import could not be completed. Open the migration again to see what happened.");
      await refresh();
    } finally {
      setCommitting(false);
    }
  }

  function reset() {
    setMigrationId(null);
    setDetail(null);
    setResult(null);
    setStep("upload");
    router.replace("/migrate", { scroll: false });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Import your business"
        description="Bring the clients, projects, invoices, and expenses you already track into Rive. Nothing is written until you have seen exactly what will happen."
      />

      {step === "upload" ? (
        <>
          <UploadStep limits={limits} busy={busy} onUpload={handleUpload} />
          <MigrationHistory onResume={(id) => router.push(`/migrate?id=${id}`)} />
        </>
      ) : null}

      {step === "analyzing" ? <AnalyzingPanel /> : null}

      {step === "found" && detail ? (
        <AnalysisStep
          detail={detail}
          onReview={() => setStep("review")}
          onContinue={() => setStep("plan")}
        />
      ) : null}

      {step === "review" && detail ? (
        <ReviewStep
          detail={detail}
          busy={busy}
          onPatch={patch}
          onRefresh={refresh}
          onContinue={() => setStep("plan")}
          onBack={() => setStep("found")}
        />
      ) : null}

      {step === "plan" && detail ? (
        <PlanStep
          detail={detail}
          committing={committing}
          onCommit={handleCommit}
          onBack={() => setStep("review")}
        />
      ) : null}

      {step === "done" && result ? (
        <SuccessStep result={result} migrationId={migrationId} onStartAnother={reset} />
      ) : null}
    </div>
  );
}

/**
 * Real progress, tied to the request that is actually running. There is no
 * simulated timer here: the screen changes when the server has finished.
 */
function AnalyzingPanel() {
  return (
    <div
      className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-card"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <h2 className="mt-4 text-base font-bold text-foreground">Reading your files</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Rive is working out what each file contains, how the columns map, and which records belong together.
      </p>
    </div>
  );
}

/** Which screen a resumed migration should open on. */
function stepForState(detail: MigrationDetail): Step {
  const { state } = detail.migration;
  if (state === "completed" || state === "completed_with_issues") return "done";
  if (state === "rolled_back") return "upload";
  if (state === "review_required") return "review";
  if (state === "ready") return "plan";
  return "found";
}
