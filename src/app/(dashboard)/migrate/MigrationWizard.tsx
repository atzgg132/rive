"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

import { Alert, Button, Card, CardContent, PageHeader, Select } from "@/components/ui";
import UploadStep from "./steps/UploadStep";
import AnalysisStep from "./steps/AnalysisStep";
import ReviewStep from "./steps/ReviewStep";
import PlanStep from "./steps/PlanStep";
import SuccessStep from "./steps/SuccessStep";
import MigrationHistory from "./MigrationHistory";
import type { MigrationDetail, MigrationLimits } from "./types";

type Step = "upload" | "analyzing" | "found" | "review" | "plan" | "committing" | "recovery" | "done";

type TransferState = { name: string; state: "waiting" | "uploading" | "verified" | "failed"; percent: number; message?: string };

type CommitResult = { created: Record<string, number>; linked: number; skipped: number; total: number };

function resultFromSummary(summary: Record<string, unknown> | null): CommitResult | null {
  if (!summary || typeof summary !== "object") return null;
  const created = summary.created as Record<string, number> | undefined;
  const linked = summary.linked as number | undefined;
  const skipped = summary.skipped as number | undefined;
  if (!created || typeof linked !== "number" || typeof skipped !== "number") return null;
  const total = Object.values(created).reduce((sum, count) => sum + count, 0) + linked;
  return { created, linked, skipped, total };
}

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
  const [transfers, setTransfers] = useState<TransferState[]>([]);
  const analysisKickoffRef = useRef<string | null>(null);

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
        const nextStep = stepForState(data);
        if (nextStep === "done") setResult(resultFromSummary(data.summary));
        setStep(nextStep);
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

  // If the browser closed after the final object was verified but before the
  // enqueue request, resume that durable boundary automatically.
  useEffect(() => {
    if (!migrationId || detail?.migration.state !== "uploading" || analysisKickoffRef.current === migrationId) return;
    const durableFiles = detail.sources.filter((source) => source.uploadStatus !== "superseded");
    if (!durableFiles.length || durableFiles.some((source) => !["verified", "parsed"].includes(source.uploadStatus))) return;
    analysisKickoffRef.current = migrationId;
    void fetch(`/api/migrations/${migrationId}/analyze`, { method: "POST" })
      .then(() => load(migrationId))
      .catch(() => {
        analysisKickoffRef.current = null;
      });
  }, [detail, migrationId, load]);

  // Analysis and commit both survive refreshes. The UI polls persisted phase
  // progress; it never relies on the request that happened to start the job.
  useEffect(() => {
    if (!["analyzing", "committing"].includes(step) || !migrationId) return;
    let cancelled = false;
    const poll = setInterval(async () => {
      try {
        const data = await load(migrationId);
        if (cancelled) return;
        const next = stepForState(data);
        if (next === "done") {
          setResult(resultFromSummary(data.summary));
          setStep("done");
        } else if (next !== step) {
          setStep(next);
        }
      } catch {
        // Transient — the next tick tries again.
      }
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [step, migrationId, load]);

  async function handleUpload(files: File[], defaultCurrency: string) {
    let activeMigrationId: string | null = null;
    setBusy(true);
    setStep("analyzing");
    try {
      const manifests = await Promise.all(files.map(async (file) => ({
        name: file.name,
        mimeType: mimeTypeFor(file),
        sizeBytes: file.size,
        checksum: await sha256(file),
      })));
      let response = await fetch("/api/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: manifests, defaultCurrency }),
      });
      let data = await response.json();

      if (response.status === 409 && data.code === "identical_import_unfinished" && data.migrationId) {
        activeMigrationId = data.migrationId;
        setMigrationId(data.migrationId);
        router.replace(`/migrate?id=${data.migrationId}`, { scroll: false });
        const loaded = await load(data.migrationId);
        setStep(stepForState(loaded));
        toast.info("Resumed your existing migration for these files.");
        return;
      }
      if (response.status === 409 && data.code === "identical_import_completed" && data.migrationId) {
        const importAgain = window.confirm("These exact files were imported before. Import the same bytes again intentionally?");
        if (!importAgain) {
          router.push(`/migrate?id=${data.migrationId}`);
          return;
        }
        response = await fetch("/api/migrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: manifests, defaultCurrency, confirmDuplicate: true }),
        });
        data = await response.json();
      }

      // Local and isolated test environments may deliberately omit S3. Keep
      // the existing request path there; deployed environments use durable PUTs.
      if (response.status === 503 && data.code === "durable_uploads_unavailable") {
        const form = new FormData();
        files.forEach((file) => form.append("files", file));
        if (defaultCurrency) form.set("defaultCurrency", defaultCurrency);
        response = await fetch("/api/migrations", { method: "POST", body: form });
        data = await response.json();
        if (!response.ok) throw new Error(data.message || "These files could not be read.");
      } else {
        if (!response.ok) throw new Error(data.message || "These files could not be prepared.");
        activeMigrationId = data.migrationId;
        setMigrationId(data.migrationId);
        router.replace(`/migrate?id=${data.migrationId}`, { scroll: false });
        setTransfers(files.map((file) => ({ name: file.name, state: "waiting", percent: 0 })));
        await Promise.all(data.uploads.map(async (instruction: { fileId: string; name: string; uploadUrl: string; headers: Record<string, string> }) => {
          const file = files.find((candidate) => candidate.name === instruction.name);
          if (!file) throw new Error(`Could not match ${instruction.name} to its upload.`);
          try {
            await uploadWithProgress(file, instruction, (percent) => updateTransfer(instruction.name, { state: "uploading", percent }));
          } catch {
            const retryResponse = await fetch(`/api/migrations/${data.migrationId}/files/${instruction.fileId}/complete`, { method: "PUT" });
            const retry = await retryResponse.json();
            if (!retryResponse.ok) throw new Error(retry.message || `${instruction.name} could not be retried.`);
            try {
              await uploadWithProgress(file, retry, (percent) => updateTransfer(instruction.name, { state: "uploading", percent }));
            } catch (error) {
              await fetch(`/api/migrations/${data.migrationId}/files/${instruction.fileId}/complete`, { method: "POST" }).catch(() => null);
              updateTransfer(instruction.name, { state: "failed", percent: 0, message: error instanceof Error ? error.message : "Upload interrupted." });
              throw error;
            }
          }
          const verified = await fetch(`/api/migrations/${data.migrationId}/files/${instruction.fileId}/complete`, { method: "POST" });
          const verification = await verified.json();
          if (!verified.ok) {
            updateTransfer(instruction.name, { state: "failed", percent: 100, message: verification.message });
            throw new Error(verification.message || `${instruction.name} could not be verified.`);
          }
          updateTransfer(instruction.name, { state: "verified", percent: 100 });
        }));
        const analyzed = await fetch(`/api/migrations/${data.migrationId}/analyze`, { method: "POST" });
        const analysis = await analyzed.json();
        if (!analyzed.ok) throw new Error(analysis.message || "Analysis could not be started.");
      }

      setMigrationId(data.migrationId);
      router.replace(`/migrate?id=${data.migrationId}`, { scroll: false });
      const loaded = await load(data.migrationId);
      setStep(stepForState(loaded));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "These files could not be read.");
      if (activeMigrationId) {
        const loaded = await load(activeMigrationId).catch(() => null);
        setStep(loaded ? stepForState(loaded) : "upload");
      } else {
        setStep("upload");
      }
    } finally {
      setBusy(false);
    }
  }

  function updateTransfer(name: string, change: Partial<TransferState>) {
    setTransfers((current) => current.map((file) => file.name === name ? { ...file, ...change } : file));
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
      const refreshed = await refresh();
      if (data.state === "queued_analysis" || refreshed?.migration.state === "queued_analysis") setStep("analyzing");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!migrationId || !detail?.plan) return;
    setCommitting(true);
    setStep("committing");
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

      if (response.status === 202 || data.state === "queued_commit") {
        const refreshed = await refresh();
        if (refreshed) setDetail(refreshed);
      } else {
        const refreshed = await refresh();
        if (refreshed) {
          setResult(resultFromSummary(refreshed.summary));
          setStep(stepForState(refreshed));
        }
      }
    } catch {
      toast.error("The import could not be completed. Open the migration again to see what happened.");
      const refreshed = await refresh();
      if (refreshed) {
        const nextStep = stepForState(refreshed);
        if (nextStep === "done") setResult(resultFromSummary(refreshed.summary));
        setStep(nextStep);
      }
    } finally {
      setCommitting(false);
    }
  }

  function reset() {
    setMigrationId(null);
    setDetail(null);
    setResult(null);
    setTransfers([]);
    setStep("upload");
    router.replace("/migrate", { scroll: false });
  }

  // Abandoning is non-destructive. The audit trail is retained and workspace
  // records are never deleted by this action.
  async function abandonMigration() {
    if (!migrationId) {
      reset();
      return;
    }
    if (!window.confirm("Discard this import? Nothing has been added to your workspace yet.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/migrations/${migrationId}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "This migration could not be abandoned.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This migration could not be abandoned.");
      return;
      // Ignored — worst case it stays visible, unresumed, in migration history.
    } finally {
      setBusy(false);
      reset();
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Import your business"
          description="Bring the clients, projects, invoices, and expenses you already track into Rive. Nothing is written until you have seen exactly what will happen."
        />
        {["found", "review", "plan"].includes(step) ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void abandonMigration()}>
            Discard and start over
          </Button>
        ) : null}
      </div>

      {step === "upload" ? (
        <>
          <UploadStep limits={limits} busy={busy} onUpload={handleUpload} />
          <MigrationHistory onResume={(id) => router.push(`/migrate?id=${id}`)} />
        </>
      ) : null}

      {step === "analyzing" ? <AnalyzingPanel detail={detail} transfers={transfers} /> : null}

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

      {step === "committing" ? <CommittingPanel detail={detail} /> : null}

      {step === "recovery" && detail ? (
        <RecoveryPanel
          detail={detail}
          busy={busy}
          onRetry={async () => {
            setBusy(true);
            try {
              const response = await fetch(`/api/migrations/${detail.migration.id}/retry`, { method: "POST" });
              const data = await response.json();
              if (!response.ok) throw new Error(data.message || "This phase could not be retried.");
              setStep(data.state === "queued_commit" ? "committing" : "analyzing");
              await refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "This phase could not be retried.");
            } finally {
              setBusy(false);
            }
          }}
          onSupport={async () => {
            setBusy(true);
            try {
              const response = await fetch(`/api/migrations/${detail.migration.id}/support`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contactAllowed: true }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.message || "The request could not be sent.");
              toast.success(`Rive support has the details. Reference ${data.reference}.`);
              await refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "The request could not be sent.");
            } finally {
              setBusy(false);
            }
          }}
          onReplace={async (fileId, file) => {
            setBusy(true);
            try {
              const response = await fetch(`/api/migrations/${detail.migration.id}/files/${fileId}/complete`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: file.name,
                  mimeType: mimeTypeFor(file),
                  sizeBytes: file.size,
                  checksum: await sha256(file),
                }),
              });
              const instruction = await response.json();
              if (!response.ok) throw new Error(instruction.message || "The replacement could not be prepared.");
              setTransfers((current) => [...current.filter((item) => item.name !== file.name), { name: file.name, state: "uploading", percent: 0 }]);
              await uploadWithProgress(file, instruction, (percent) => updateTransfer(file.name, { state: "uploading", percent }));
              const completed = await fetch(`/api/migrations/${detail.migration.id}/files/${fileId}/complete`, { method: "POST" });
              const completion = await completed.json();
              if (!completed.ok) throw new Error(completion.message || "The replacement could not be verified.");
              updateTransfer(file.name, { state: "verified", percent: 100 });
              const analysisResponse = await fetch(`/api/migrations/${detail.migration.id}/analyze`, { method: "POST" });
              const analysis = await analysisResponse.json();
              if (!analysisResponse.ok) throw new Error(analysis.message || "Analysis could not be restarted.");
              setStep("analyzing");
              await refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "The replacement could not be uploaded.");
              await refresh();
            } finally {
              setBusy(false);
            }
          }}
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
function AnalyzingPanel({ detail, transfers }: { detail: MigrationDetail | null; transfers: TransferState[] }) {
  const percent = detail?.progress.percent || 0;
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
      <div className="mt-5 w-full max-w-lg" role="progressbar" aria-label="Migration analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {detail?.progress.phase ? `${detail.progress.phase.replaceAll("_", " ")} · ` : ""}{percent}%
        </p>
      </div>
      {transfers.length ? (
        <ul className="mt-5 w-full max-w-lg space-y-2 text-left" aria-label="File upload progress">
          {transfers.map((file) => (
            <li key={file.name} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs">
              <span className="truncate text-foreground">{file.name}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                {file.state === "verified" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : null}
                {file.state === "failed" ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" /> : null}
                {file.state} {file.state === "uploading" ? `${file.percent}%` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Which screen a resumed migration should open on. */
function stepForState(detail: MigrationDetail): Step {
  const { state } = detail.migration;
  if (state === "completed" || state === "completed_with_issues") return "done";
  if (state === "abandoned" || state === "rolled_back") return "upload";
  if (state === "review_required") return "review";
  // A commit that failed is retried from the plan screen with one click —
  // the plan the user already reviewed is still there and still valid.
  if (state === "ready") return "plan";
  if (state === "failed") return "recovery";
  // A commit still in flight (or one that died and hasn't been marked
  // failed yet) gets its own screen rather than the analysis screen, which
  // would otherwise imply nothing had started.
  if (state === "committing" || state === "queued_commit") return "committing";
  if (state === "uploading" && detail.sources.some((source) => !["verified", "parsed", "superseded"].includes(source.uploadStatus))) return "recovery";
  if (["created", "uploading", "queued_analysis", "profiling", "mapping"].includes(state)) return "analyzing";
  return "found";
}

function CommittingPanel({ detail }: { detail: MigrationDetail | null }) {
  const percent = detail?.progress.percent || 0;
  return (
    <div
      className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-card"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <h2 className="mt-4 text-base font-bold text-foreground">Finishing your import</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        This picks up automatically — nothing already imported will be imported twice.
      </p>
      <div className="mt-5 w-full max-w-lg" role="progressbar" aria-label="Migration commit progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} /></div>
        <p className="mt-2 text-xs text-muted-foreground">{detail?.progress.completed || 0} of {detail?.progress.total || 0} operations · {percent}%</p>
      </div>
    </div>
  );
}

function RecoveryPanel({
  detail,
  busy,
  onRetry,
  onSupport,
  onReplace,
}: {
  detail: MigrationDetail;
  busy: boolean;
  onRetry: () => Promise<void>;
  onSupport: () => Promise<void>;
  onReplace: (fileId: string, file: File) => Promise<void>;
}) {
  const recovery = detail.recovery;
  const completed = detail.migration.failurePhase === "commit" ? recovery.appliedCount : detail.progress.completed;
  const pending = detail.migration.failurePhase === "commit"
    ? recovery.pendingCount
    : Math.max(0, detail.progress.total - detail.progress.completed);
  const replacementInput = useRef<HTMLInputElement>(null);
  const replacementCandidates = detail.sources.filter((source) => source.uploadStatus !== "superseded");
  const initiallyFailed = replacementCandidates.find((source) => !["verified", "parsed"].includes(source.uploadStatus));
  const [replacementTarget, setReplacementTarget] = useState(initiallyFailed?.fileId || replacementCandidates[0]?.fileId || "");
  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-lg bg-destructive/10 p-2 text-destructive"><AlertTriangle className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 className="text-base font-bold text-foreground">The {detail.migration.failurePhase || "migration"} phase stopped safely</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {completed.toLocaleString()} {detail.migration.failurePhase === "commit" ? "operations landed" : "items completed"} and {pending.toLocaleString()} remain.
              Retrying resumes this exact plan and skips everything already applied.
            </p>
          </div>
        </div>
        {detail.migration.error ? <Alert variant="warning">{detail.migration.error}</Alert> : null}
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Support reference: <span className="font-semibold text-foreground">{recovery.supportReference}</span>. No filenames or cell values are sent with a help request.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !recovery.canRetry} onClick={() => void onRetry()}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Retry safely
          </Button>
          <Button type="button" variant="secondary" disabled={busy || recovery.supportRequested} onClick={() => void onSupport()}>
            {recovery.supportRequested ? "Help requested" : "Ask Rive for help"}
          </Button>
          {recovery.canReplaceFiles && replacementCandidates.length ? (
            <>
              <input
                ref={replacementInput}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && replacementTarget) void onReplace(replacementTarget, file);
                  event.target.value = "";
                }}
              />
              {replacementCandidates.length > 1 ? (
                <Select aria-label="Source file to replace" value={replacementTarget} onChange={(event) => setReplacementTarget(event.target.value)} disabled={busy}>
                  {replacementCandidates.map((source) => <option key={source.fileId} value={source.fileId}>{source.name}{source.sheetName ? ` · ${source.sheetName}` : ""}</option>)}
                </Select>
              ) : null}
              <Button type="button" variant="secondary" disabled={busy} onClick={() => replacementInput.current?.click()}>
                Replace a source file
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mimeTypeFor(file: File): string {
  if (/\.xlsx$/i.test(file.name)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "text/csv";
}

function uploadWithProgress(
  file: File,
  instruction: { uploadUrl: string; headers: Record<string, string> },
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", instruction.uploadUrl);
    for (const [name, value] of Object.entries(instruction.headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error(`${file.name} upload failed (${request.status}).`));
    request.onerror = () => reject(new Error(`${file.name} upload was interrupted.`));
    request.send(file);
  });
}
