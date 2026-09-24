"use client";

import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  Kicker,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  FileSignature,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { localeForCurrency } from "@/lib/currency";
import { CONTRACT_CONSENT_TEXT, CONTRACT_CONSENT_TEXT_VERSION } from "@/lib/agreementConsent";
import ContractWorkSetupCard from "@/components/contracts/ContractWorkSetupCard";

type Section = { key: string; title: string; body: string; enabled: boolean; required?: boolean };
type PaymentDraft = { label: string; amount: string; currency: string; triggerType: string; triggerDate: string; dueDays: string; milestoneId: string; invoiceDescription: string };
type Content = {
  title: string;
  ownerName?: string;
  ownerEmail?: string;
  clientName?: string;
  clientEmail?: string | null;
  clientCompany?: string | null;
  clientAddress?: string | null;
  projectTitle?: string | null;
  projectDescription?: string | null;
  governingLaw?: string;
  jurisdiction?: string | null;
  sections: Section[];
  paymentPlan?: { currency?: string; items: Array<{ id: string; label: string; amount: string; currency: string; triggerType: string; triggerDate: string | null; dueDays: number; milestoneId: string | null; milestoneTitle: string | null; invoiceDescription: string | null }> };
};
type ReviewLink = { id: string; type: string; versionId: string | null; signerId: string | null; expiresAt: string; revokedAt: string | null; createdAt: string };
type ContractEvent = { id: string; versionId: string | null; eventType: string; metadata?: Record<string, unknown> | null; createdAt: string };
type Signer = { id: string; role: "client" | "owner"; name: string; email: string; status: string; invited_at: string | null; signed_at: string | null; signatures: Array<{ versionId: string; signedAt: string; consentTextVersion: string; providerEventId?: string | null }> };
type Contract = {
  id: string;
  title: string;
  status: string;
  provider: string;
  governing_law: string;
  jurisdiction: string | null;
  currency: string;
  finalized_at: string | null;
  executed_at: string | null;
  voided_at: string | null;
  void_requested_at: string | null;
  void_requested_by_role: string | null;
  void_request_note: string | null;
  void_confirm_note: string | null;
  client: { id: string; name: string; email: string | null; company?: string | null; address?: string | null };
  project: { id: string; title: string; description?: string | null; startDate?: string | null; dueDate?: string | null; milestones?: Array<{ id: string; title: string; dueDate: string | null; completed: boolean }> } | null;
  versions: Array<{ id: string; version: number; status: string; content: Content; content_hash: string; created_at: string; finalized_at: string | null; artifacts: Array<{ id: string }> }>;
  signers: Signer[];
  review_links: ReviewLink[];
  comments: Array<{ id: string; versionId: string | null; authorRole: string; authorName: string; sectionKey: string | null; body: string; status: string; resolvedAt: string | null; createdAt: string }>;
  events: ContractEvent[];
  payment_plan: Array<{
    id: string;
    label: string;
    amount: string;
    currency: string;
    trigger_type: string;
    trigger_date: string | null;
    due_days: number;
    invoice_description: string | null;
    status: string;
    milestone: { id: string; title: string; dueDate: string | null; completed: boolean } | null;
    occurrence: { id: string; status: string; eligible_at: string | null; drafted_at: string | null; invoice: { id: string; invoiceNumber: string; status: string; total: string } | null } | null;
  }>;
  work_setup: {
    id?: string;
    status: string;
    accepted_version_id: string | null;
    preview_plan: {
      project: { mode: "create" | "reuse"; projectId: string | null; title: string; description: string | null; startDate: string | null; dueDate: string | null };
      milestones: Array<{ key: string; existingId: string | null; title: string; dueDate: string | null }>;
      tasks: Array<{ key: string; title: string; dueDate: string | null; milestoneKey: string | null; milestoneId: string | null }>;
    } | null;
    preview_hash: string | null;
    result_ids: { projectId?: string; milestoneIds?: string[]; taskIds?: string[] } | null;
    error: string | null;
  };
};
type RunAction = (key: string, url: string, method?: string, body?: unknown, preserveEditor?: boolean) => Promise<Record<string, unknown> | null>;
type Reissue = { kind: "review" | "client"; sendEmail: boolean; activeSince: string };

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

/** The newest unrevoked, unexpired link of a type for the current version. */
function activeLink(links: ReviewLink[], type: string, versionId: string | undefined, signerId?: string): ReviewLink | null {
  const now = Date.now();
  return links.find((link) => link.type === type && !link.revokedAt && new Date(link.expiresAt).getTime() > now && link.versionId === versionId && (!signerId || link.signerId === signerId)) || null;
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [freshReviewUrl, setFreshReviewUrl] = useState("");
  const [freshClientUrl, setFreshClientUrl] = useState("");
  const [pendingReissue, setPendingReissue] = useState<Reissue | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSections, setEditSections] = useState<Section[]>([]);
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editGoverningLaw, setEditGoverningLaw] = useState("India");
  const [editJurisdiction, setEditJurisdiction] = useState("");
  const [editPayments, setEditPayments] = useState<PaymentDraft[]>([]);
  const [syncProjectSnapshot, setSyncProjectSnapshot] = useState(false);
  const [comment, setComment] = useState("");
  const [finalizeOpenComments, setFinalizeOpenComments] = useState<number | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidNote, setVoidNote] = useState("");
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [ownerTypedName, setOwnerTypedName] = useState("");
  const [ownerConsent, setOwnerConsent] = useState(false);
  const [ownerDeclineOpen, setOwnerDeclineOpen] = useState(false);
  const [ownerDeclineReason, setOwnerDeclineReason] = useState("");
  const [engagementInvoiceId, setEngagementInvoiceId] = useState<string | null>(null);
  const [createdFromEngagement, setCreatedFromEngagement] = useState(false);

  const hydrateEditor = (nextContract: Contract) => {
    const latest = nextContract.versions[0]?.content;
    setEditTitle(nextContract.title);
    setEditSections(latest?.sections || []);
    setEditCurrency(nextContract.currency || "USD");
    setEditGoverningLaw(latest?.governingLaw || nextContract.governing_law || "India");
    setEditJurisdiction(latest?.jurisdiction ?? nextContract.jurisdiction ?? "");
    setEditPayments((latest?.paymentPlan?.items || []).map((item) => ({
      label: item.label,
      amount: item.amount,
      currency: item.currency,
      triggerType: item.triggerType,
      triggerDate: item.triggerDate ? item.triggerDate.slice(0, 10) : "",
      dueDays: String(item.dueDays),
      milestoneId: item.milestoneId || "",
      invoiceDescription: item.invoiceDescription || "",
    })));
    setSyncProjectSnapshot(false);
  };

  const load = async (preserveEditor = false) => {
    if (!id) return;
    setLoadError("");
    try {
      const response = await fetch(`/api/workflow/contracts/${id}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to load Agreement.");
      setContract(payload.contract);
      if (!preserveEditor) hydrateEditor(payload.contract);
      if (typeof window !== "undefined") {
        const query = new URLSearchParams(window.location.search);
        if (query.get("from") === "engagement") {
          setCreatedFromEngagement(true);
          setEngagementInvoiceId(query.get("nextInvoiceId"));
          if (query.get("edit") === "1") setEditing(true);
        }
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load Agreement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  // load intentionally rehydrates when the route id changes; action refreshes call it directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const runAction: RunAction = async (key, url, method = "POST", body, preserveEditor = true) => {
    if (!id || busy) return null;
    setBusy(key);
    try {
      const response = await fetch(url, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        if (payload.code === "OPEN_REVIEW_COMMENTS") {
          setFinalizeOpenComments(Number(payload.openCommentCount) || 1);
          return null;
        }
        throw new Error(payload.message || "Action failed.");
      }
      if (typeof payload.reviewUrl === "string") setFreshReviewUrl(payload.reviewUrl);
      if (typeof payload.clientSignUrl === "string") setFreshClientUrl(payload.clientSignUrl);
      if (payload.role === "client" && typeof payload.signUrl === "string") setFreshClientUrl(payload.signUrl);
      if (payload.email && payload.email.sent === false) toast.warning(payload.message || "The link was created, but email delivery failed.");
      else toast.success(payload.message || "Updated.");
      await load(preserveEditor);
      return payload;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const saveEdits = async () => {
    if (!contract) return;
    const payload = await runAction("save", `/api/workflow/contracts/${id}`, "PUT", {
      title: editTitle,
      currency: editCurrency,
      governingLaw: editGoverningLaw,
      jurisdiction: editJurisdiction,
      sections: editSections,
      paymentPlan: editPayments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
        currency: editCurrency,
        dueDays: Number(payment.dueDays || 7),
        triggerDate: payment.triggerDate || null,
        milestoneId: payment.milestoneId || null,
      })),
      syncProjectSnapshot,
    }, false);
    if (payload) {
      setEditing(false);
      setFreshReviewUrl("");
      setFreshClientUrl("");
    }
  };

  const finalize = async (acknowledgeOpenComments = false) => {
    const payload = await runAction("finalize", `/api/workflow/contracts/${id}/finalize`, "POST", { acknowledgeOpenComments });
    if (payload) setFinalizeOpenComments(null);
    return payload;
  };

  const issueLink = async (kind: "review" | "client", sendEmail: boolean) => {
    if (kind === "review") await runAction(sendEmail ? "review-email" : "review", `/api/workflow/contracts/${id}/review`, "POST", { sendEmail });
    else await runAction(sendEmail ? "client-email" : "client-link", `/api/workflow/contracts/${id}/signing-links`, "POST", { role: "client", sendEmail });
  };

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success("Link copied."); }
    catch { toast.error("Copy failed; select the link manually."); }
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Agreement…</div>;
  if (loadError || !contract) return <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Agreement unavailable" description={loadError || "The Agreement was not found."} action={<Link href="/workflow/contracts" className={buttonVariants({ variant: "outline" })}>Back to Agreements</Link>} />;

  const version = contract.versions[0];
  const content = version?.content;
  const displayClientName = content?.clientName || contract.client.name;
  const displayClientEmail = content ? content.clientEmail : contract.client.email;
  const displayClientCompany = content ? content.clientCompany : contract.client.company;
  const displayClientAddress = content ? content.clientAddress : contract.client.address;
  const projectSnapshotChanged = Boolean(contract.project && ((content?.projectTitle || "") !== contract.project.title || (content?.projectDescription || "") !== (contract.project.description || "")));
  const clientSigner = contract.signers.find((signer) => signer.role === "client");
  const ownerSigner = contract.signers.find((signer) => signer.role === "owner");
  const clientAcceptance = clientSigner?.signatures.find((signature) => signature.versionId === version?.id) || null;
  const hasSignature = contract.signers.some((signer) => signer.signatures.some((signature) => signature.versionId === version?.id));
  const canEdit = ["draft", "in_review", "declined", "expired", "ready_to_sign"].includes(contract.status) && (!hasSignature || ["declined", "expired"].includes(contract.status));
  const canReview = ["draft", "in_review", "expired"].includes(contract.status) && version?.status !== "final" && !hasSignature;
  const canFinalize = ["draft", "in_review", "expired"].includes(contract.status) && !hasSignature;
  const canOwnerAccept = Boolean(ownerSigner?.status === "pending" && clientSigner?.status === "signed" && clientAcceptance && ["signing", "expired"].includes(contract.status) && version?.status === "final");
  const canRestartAcceptance = contract.status === "expired" && version?.status === "final" && !hasSignature;
  const currentComments = contract.comments.filter((item) => item.versionId === version?.id);
  const openComments = currentComments.filter((item) => item.status === "open");
  const reviewApproved = version?.status === "approved";
  const activeReview = activeLink(contract.review_links, "review", version?.id);
  const activeClientLink = clientSigner ? activeLink(contract.review_links, "sign", version?.id, clientSigner.id) : null;
  // Links matter until the client has accepted; after that nothing needs sharing.
  const showShare = canReview || ["ready_to_sign", "starting"].includes(contract.status) || (contract.status === "signing" && !clientAcceptance) || canRestartAcceptance;

  const requestLink = (kind: "review" | "client", sendEmail: boolean) => {
    const active = kind === "review" ? activeReview : activeClientLink;
    if (active) {
      setPendingReissue({ kind, sendEmail, activeSince: active.createdAt });
      return;
    }
    void issueLink(kind, sendEmail);
  };

  const restartAcceptance = async () => {
    const finalized = await finalize();
    if (finalized) await runAction("sign", `/api/workflow/contracts/${id}/start-signing`);
  };

  const acceptAsOwner = async () => {
    const payload = await runAction("owner-accept", `/api/workflow/contracts/${id}/accept`, "POST", { typedName: ownerTypedName, consentAccepted: ownerConsent });
    if (payload) {
      setAcceptOpen(false);
      setOwnerTypedName("");
      setOwnerConsent(false);
    }
  };

  const declineAsOwner = async () => {
    const payload = await runAction("owner-decline", `/api/workflow/contracts/${id}/accept`, "POST", { action: "decline", reason: ownerDeclineReason });
    if (payload) {
      setAcceptOpen(false);
      setOwnerDeclineOpen(false);
      setOwnerDeclineReason("");
      setEditing(true);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 animate-panel-in">
      {createdFromEngagement && (
        <div className="rounded-none border border-success/30 bg-success/10 p-4 text-sm text-foreground">
          <p className="font-bold">Your engagement is connected and this Agreement is still private.</p>
          <p className="mt-1 text-xs leading-5">Review the editable draft before sharing it with your client.</p>
          {engagementInvoiceId && (
            <Link href={`/workflow/invoices/new?invoiceId=${encodeURIComponent(engagementInvoiceId)}&from=engagement`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold underline">
              Review the linked invoice next <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/workflow/contracts" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Agreements</Link>
        <div className="flex flex-wrap items-center gap-2"><StatusBadge kind="contract" value={contract.status} /><Badge variant="outline">Version {version?.version || "—"}</Badge></div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0"><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{contract.title}</h1><p className="mt-2 text-sm text-muted-foreground"><Link href={`/workflow/clients/${contract.client.id}`} className="font-semibold hover:text-primary hover:underline">{displayClientName}</Link>{displayClientEmail ? ` · ${displayClientEmail}` : " · email missing"}{contract.project ? <> · <Link href={`/workflow/projects/${contract.project.id}`} className="font-semibold hover:text-primary hover:underline">{contract.project.title}</Link></> : " · standalone agreement"}</p>{(displayClientCompany || displayClientAddress) ? <p className="mt-1 text-xs text-muted-foreground">{[displayClientCompany, displayClientAddress].filter(Boolean).join(" · ")}</p> : null}</div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? <Button variant="outline" onClick={() => setEditing((current) => !current)}><Pencil className="h-4 w-4" /> {editing ? "Close editor" : "Edit draft"}</Button> : null}
          {contract.status === "executed" ? <Button onClick={() => window.open(`/api/workflow/contracts/${id}/artifact`, "_blank")}><Download className="h-4 w-4" /> Download accepted PDF</Button> : null}
          {contract.status === "executed" && contract.client.email ? <Button variant="outline" disabled={Boolean(busy)} onClick={() => void runAction("accepted-copy", `/api/workflow/contracts/${id}/accepted-copy`)}><Mail className="h-4 w-4" /> Resend accepted copy</Button> : null}
          {contract.status !== "executed" && contract.status !== "void" ? <Button variant="ghost" className="text-destructive" onClick={() => setVoidDialogOpen(true)}><XCircle className="h-4 w-4" /> Void</Button> : null}
        </div>
      </div>

      {contract.status === "executed" ? (
        <div className="rounded-none border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
          {contract.void_requested_at ? (
            contract.void_requested_by_role === "client" ? (
              <>
                <p className="font-bold">The client requested to void this accepted Agreement.</p>
                {contract.void_request_note ? <p className="mt-1 whitespace-pre-wrap text-xs">{contract.void_request_note}</p> : null}
                <textarea className="mt-3 w-full rounded-none border border-border bg-background px-3 py-2 text-sm text-foreground" rows={2} placeholder="Add a short confirmation note" value={voidNote} onChange={(event) => setVoidNote(event.target.value)} />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" disabled={Boolean(busy) || voidNote.trim().length < 5} onClick={() => void runAction("void-confirm", `/api/workflow/contracts/${id}/void`, "POST", { action: "confirm", note: voidNote })}>Confirm void</Button>
                  <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void runAction("void-decline", `/api/workflow/contracts/${id}/void`, "POST", { action: "decline", note: voidNote })}>Decline</Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p><strong>Void requested {formatDate(contract.void_requested_at)}.</strong> Waiting for the client to confirm from their email — the Agreement stays accepted until then.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void runAction("void-resend", `/api/workflow/contracts/${id}/void`, "POST", { action: "resend" })}><Send className="h-3.5 w-3.5" /> Resend email</Button>
                  <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void runAction("void-decline", `/api/workflow/contracts/${id}/void`, "POST", { action: "decline", note: "" })}>Withdraw request</Button>
                </div>
              </div>
            )
          ) : (
            <>
              <p className="font-bold">Void this accepted Agreement</p>
              <p className="mt-1 text-xs">Both parties must agree. The client is emailed a link to confirm; the record is retained either way.</p>
              <textarea className="mt-3 w-full rounded-none border border-border bg-background px-3 py-2 text-sm text-foreground" rows={2} placeholder="Add a short reason for the void request" value={voidNote} onChange={(event) => setVoidNote(event.target.value)} />
              <Button size="sm" variant="default" className="mt-2" disabled={Boolean(busy) || voidNote.trim().length < 5} onClick={() => void runAction("void-request", `/api/workflow/contracts/${id}/void`, "POST", { action: "request", note: voidNote })}>Request void</Button>
            </>
          )}
        </div>
      ) : null}

      <ContractProgress status={contract.status} />

      <NextActionCard
        contract={contract}
        clientAcceptedAt={clientAcceptance?.signedAt || null}
        versionStatus={version?.status || null}
        versionApproved={reviewApproved}
        openComments={openComments.length}
        canFinalize={canFinalize}
        canOwnerAccept={canOwnerAccept}
        canRestartAcceptance={canRestartAcceptance}
        busy={busy}
        onAction={runAction}
        onFinalize={() => void finalize()}
        onAcceptOwn={() => setAcceptOpen(true)}
        onRestart={() => void restartAcceptance()}
        onEdit={() => setEditing(true)}
      />

      {contract.status === "executed" ? <ContractWorkSetupCard contractId={contract.id} project={contract.project} acceptedContent={content} setup={contract.work_setup} onRefresh={() => load(true)} /> : null}

      {showShare ? (
        <ShareLinksCard
          clientName={clientSigner?.name || contract.client.name}
          clientEmail={contract.client.email}
          status={contract.status}
          canReview={canReview}
          clientSigner={clientSigner || null}
          clientAcceptedAt={clientAcceptance?.signedAt || null}
          activeReview={activeReview}
          activeClientLink={activeClientLink}
          freshReviewUrl={freshReviewUrl}
          freshClientUrl={freshClientUrl}
          busy={busy}
          onRequest={requestLink}
          onCopy={copy}
        />
      ) : null}

      {editing && canEdit && projectSnapshotChanged ? <Alert variant="warning" className="text-xs"><RefreshCw className="h-4 w-4" /><div><p className="font-bold">The linked project brief changed after this version</p><p className="mt-1 text-muted-foreground">A legal snapshot never changes silently. Keep it as-is, or explicitly pull the current project title and description into the new version.</p><label className="mt-2 flex items-center gap-2 font-semibold"><input type="checkbox" checked={syncProjectSnapshot} onChange={(event) => setSyncProjectSnapshot(event.target.checked)} className="h-4 w-4 accent-primary" /> Use the current project brief in this new version</label></div></Alert> : null}

      {editing && canEdit ? (
        <Editor
          contract={contract}
          title={editTitle}
          setTitle={setEditTitle}
          currency={editCurrency}
          setCurrency={setEditCurrency}
          governingLaw={editGoverningLaw}
          setGoverningLaw={setEditGoverningLaw}
          jurisdiction={editJurisdiction}
          setJurisdiction={setEditJurisdiction}
          sections={editSections}
          setSections={setEditSections}
          payments={editPayments}
          setPayments={setEditPayments}
          saving={busy === "save"}
          onSave={() => void saveEdits()}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card>
          <CardHeader><CardTitle>Agreement terms</CardTitle><CardDescription>Immutable version {version?.version} · hash <span className="break-all font-mono text-xs tabular-nums">{version?.content_hash}</span></CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-5 pt-0 sm:pt-0">
            {content?.projectTitle ? <section className="rounded-none border border-primary/20 bg-primary/5 p-4"><h2 className="text-sm font-bold">Linked project brief snapshot</h2><p className="mt-1 text-xs font-semibold text-primary">{content.projectTitle}</p>{content.projectDescription ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{content.projectDescription}</p> : null}</section> : null}
            {content?.sections?.filter((section) => section.enabled).map((section) => <section key={section.key} className="border-b border-border pb-5 last:border-0 last:pb-0"><h2 className="mb-2 text-sm font-bold">{section.title}</h2><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{section.body}</p></section>)}
            <PaymentPlan contract={contract} busy={busy} runAction={runAction} />
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Acceptance parties</CardTitle><CardDescription>The client accepts from their link first; you record yours here. Rive is not a party.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0 sm:pt-0">
              {contract.signers.map((signer) => (
                <div key={signer.id} className="rounded-none border border-border p-3">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{signer.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{signer.role === "owner" ? "you" : "client"} · {signer.email}</p></div><Badge variant={signer.status === "signed" ? "success" : signer.status === "declined" ? "destructive" : "outline"}>{signer.status === "signed" ? "accepted" : signer.status === "declined" ? "requested changes" : signer.status}</Badge></div>
                  {signer.signatures.map((signature) => <p key={signature.signedAt} className="mt-2 text-xs leading-4 text-muted-foreground">Acceptance recorded {new Date(signature.signedAt).toLocaleString()} · consent {signature.consentTextVersion}</p>)}
                  {signer.role === "owner" && canOwnerAccept ? <Button size="sm" className="mt-3" disabled={Boolean(busy)} onClick={() => setAcceptOpen(true)}><FileSignature className="h-3.5 w-3.5" /> Record your acceptance</Button> : null}
                </div>
              ))}
              {contract.status === "declined" && hasSignature ? <Alert variant="warning" className="text-xs"><AlertTriangle className="h-4 w-4" /><div><p className="font-bold">An acceptance record already exists on this version</p><p className="mt-1 text-muted-foreground">Use Edit draft to save the requested changes as a new version, then request acceptance again. The earlier acceptance stays attached to this version as evidence.</p></div></Alert> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>Review comments</CardTitle><CardDescription>{openComments.length} open on version {version?.version}</CardDescription></div>{reviewApproved ? <Badge variant="success"><UserRoundCheck className="h-3.5 w-3.5" /> Client ready</Badge> : null}</div></CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0 sm:pt-0">
              {currentComments.length === 0 ? <p className="text-sm text-muted-foreground">No comments on this version.</p> : currentComments.map((item) => (
                <div key={item.id} className={`rounded-none border p-3 ${item.status === "resolved" ? "border-border bg-muted/30" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-3 text-xs"><span className="font-semibold">{item.authorName} · {item.authorRole}</span><Badge variant={item.status === "resolved" ? "secondary" : "warning"}>{item.status}</Badge></div>
                  {item.sectionKey ? <Kicker className="mt-1">{item.sectionKey}</Kicker> : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-5">{item.body}</p>
                  <Button size="sm" variant="ghost" className="mt-2" disabled={busy === `comment-${item.id}`} onClick={() => void runAction(`comment-${item.id}`, `/api/workflow/contracts/${id}/comments`, "PATCH", { commentId: item.id, status: item.status === "resolved" ? "open" : "resolved" })}>{item.status === "resolved" ? "Reopen" : "Mark resolved"}</Button>
                </div>
              ))}
              {!hasSignature && contract.status !== "void" ? <><Textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Reply or record an internal negotiation note…" maxLength={4_000} /><Button variant="outline" disabled={!comment.trim() || busy === "comment"} onClick={async () => { const result = await runAction("comment", `/api/workflow/contracts/${id}/comments`, "POST", { body: comment }); if (result) setComment(""); }}><Send className="h-4 w-4" /> Add note</Button></> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Version & evidence history</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4 pt-0 sm:pt-0">
              <div className="space-y-2">{contract.versions.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold">Version {item.version} · {formatVersionStatus(item.status)}</span><span className="font-mono tabular-nums text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span></div>)}</div>
              <div className="border-t border-border pt-3"><Kicker tone="muted" dot={false} className="mb-2">Recent Agreement evidence events</Kicker><div className="space-y-2">{contract.events.slice(0, 12).map((event) => <div key={event.id} className="flex items-start justify-between gap-3 text-xs"><span className="font-medium">{formatContractEvent(event)}</span><span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span></div>)}</div></div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={finalizeOpenComments !== null} onOpenChange={(open) => { if (!open && busy !== "finalize") setFinalizeOpenComments(null); }}>
        <DialogContent>
          <AlertTriangle className="h-8 w-8 text-warning" />
          <DialogTitle className="mt-3 text-lg font-extrabold tracking-[-0.03em]">Finalize with open comments?</DialogTitle>
          <DialogDescription className="mt-2 leading-6">{finalizeOpenComments} review comment{finalizeOpenComments === 1 ? " is" : "s are"} unresolved. Finalizing locks this exact version and stops further review comments.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setFinalizeOpenComments(null)}>Go back</Button><Button disabled={busy === "finalize"} onClick={() => void finalize(true)}>{busy === "finalize" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Finalize anyway</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingReissue !== null} onOpenChange={(open) => { if (!open) setPendingReissue(null); }}>
        <DialogContent>
          <AlertTriangle className="h-8 w-8 text-warning" />
          <DialogTitle className="mt-3 text-lg font-extrabold tracking-[-0.03em]">Replace the current {pendingReissue?.kind === "review" ? "review" : "acceptance"} link?</DialogTitle>
          <DialogDescription className="mt-2 leading-6">The link created on {formatDate(pendingReissue?.activeSince)} stops working as soon as you continue. {pendingReissue?.sendEmail ? `${contract.client.name} will be emailed the new link.` : `Send the new link to ${contract.client.name} yourself.`}</DialogDescription>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setPendingReissue(null)}>Keep current link</Button><Button disabled={Boolean(busy)} onClick={() => { const next = pendingReissue; setPendingReissue(null); if (next) void issueLink(next.kind, next.sendEmail); }}><RefreshCw className="h-4 w-4" /> Replace link</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={acceptOpen} onOpenChange={(open) => { if (!busy) setAcceptOpen(open); }}>
        <DialogContent>
          <FileSignature className="h-8 w-8 text-primary" />
          <DialogTitle className="mt-3 text-lg font-extrabold tracking-[-0.03em]">Record your acceptance</DialogTitle>
          <DialogDescription className="mt-2 leading-6">You are accepting version {version?.version} of “{contract.title}” as {ownerSigner?.name}. {clientSigner?.name} accepted on {formatDate(clientAcceptance?.signedAt)}. Both acceptances complete the Agreement and start its payment plan.</DialogDescription>
          <div className="mt-4 flex flex-col gap-3">
            <FormField label="Type your full name" required><Input value={ownerTypedName} onChange={(event) => setOwnerTypedName(event.target.value)} placeholder={ownerSigner?.name} autoComplete="name" /></FormField>
            <label className="flex gap-3 text-xs leading-5 text-muted-foreground"><input type="checkbox" checked={ownerConsent} onChange={(event) => setOwnerConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" /><span>{CONTRACT_CONSENT_TEXT}<span className="mt-1 block font-mono text-[10px]">Consent version {CONTRACT_CONSENT_TEXT_VERSION}</span></span></label>
            {ownerDeclineOpen ? (
              <div className="rounded-none border border-destructive/20 bg-destructive/5 p-3">
                <FormField label="What needs to change?"><Textarea rows={3} value={ownerDeclineReason} onChange={(event) => setOwnerDeclineReason(event.target.value)} maxLength={2_000} /></FormField>
                <p className="mt-2 text-[11px] leading-4 text-muted-foreground">This stops the acceptance request. You then edit the draft and request acceptance again; the client’s earlier acceptance stays attached to this version as evidence.</p>
                <Button variant="destructive" className="mt-3 w-full" disabled={Boolean(busy) || ownerDeclineReason.trim().length < 5} onClick={() => void declineAsOwner()}>{busy === "owner-decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Stop and revise</Button>
              </div>
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" className="text-destructive" onClick={() => setOwnerDeclineOpen((current) => !current)}>Request changes instead</Button>
            <div className="flex gap-2"><Button variant="outline" onClick={() => setAcceptOpen(false)}>Cancel</Button><Button disabled={Boolean(busy) || !ownerTypedName.trim() || !ownerConsent} onClick={() => void acceptAsOwner()}>{busy === "owner-accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Record acceptance</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={voidDialogOpen} onOpenChange={(open) => { if (busy !== "void") setVoidDialogOpen(open); }}>
        <DialogContent>
          <XCircle className="h-8 w-8 text-destructive" />
          <DialogTitle className="mt-3 text-lg font-extrabold tracking-[-0.03em]">Void this Agreement record?</DialogTitle>
          <DialogDescription className="mt-2 leading-6">Active review and acceptance links will be revoked{clientAcceptance ? `, and ${clientSigner?.name}’s recorded acceptance will no longer lead anywhere` : ""}. The Agreement record, versions, comments, and evidence stay retained for history.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setVoidDialogOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy === "void"} onClick={async () => { const result = await runAction("void", `/api/workflow/contracts/${id}`, "DELETE"); if (result) setVoidDialogOpen(false); }}>{busy === "void" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Void Agreement record</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContractProgress({ status }: { status: string }) {
  const current = status === "executed" ? 3 : ["ready_to_sign", "starting", "signing"].includes(status) ? 2 : status === "in_review" ? 1 : 0;
  const stages = ["Draft", "Client review", "Acceptance", "Accepted"];
  return <ol className="grid grid-cols-4 gap-2" aria-label="Agreement progress">{stages.map((stage, index) => <li key={stage} className="min-w-0"><div className={`h-1 rounded-none ${index <= current ? status === "void" || status === "declined" || status === "expired" ? "bg-warning" : "bg-primary" : "bg-muted"}`} /><p className={`mt-1.5 truncate text-xs font-bold sm:text-xs ${index === current ? "text-foreground" : "text-muted-foreground"}`}>{stage}</p></li>)}</ol>;
}

function formatVersionStatus(status: string): string {
  return ({ draft: "draft", approved: "client ready", final: "finalized" } as Record<string, string>)[status] || status;
}

const EVENT_LABELS: Record<string, string> = {
  contract_created: "Agreement drafted",
  contract_version_created: "New version saved",
  review_link_created: "Review link created",
  client_comment_added: "Client commented",
  owner_comment_added: "Note added",
  comment_resolved: "Comment resolved",
  comment_reopened: "Comment reopened",
  client_review_approved: "Client ready for the final version",
  client_review_approval_withdrawn: "Client commented after marking ready",
  contract_finalized: "Version finalized",
  signing_started: "Acceptance requested",
  signing_link_reissued: "New client acceptance link",
  contract_executed: "Agreement accepted",
  contract_request_expired: "Request expired",
  acceptance_request_reopened: "Acceptance request reopened",
  contract_voided: "Agreement voided",
  void_requested: "Void requested",
  void_request_declined: "Void request declined",
  void_request_withdrawn: "Void request withdrawn",
  void_request_resent: "Void request re-sent",
  void_confirmed: "Void confirmed",
  accepted_copy_sent: "Accepted copy sent to client",
  billing_draft_created: "Invoice draft created",
  billing_cancelled: "Remaining payments cancelled",
  contract_project_generated: "Work setup created",
};

function formatContractEvent(event: ContractEvent): string {
  const role = typeof event.metadata?.role === "string" ? event.metadata.role : null;
  if (event.eventType === "signer_signed") return role === "owner" ? "You accepted" : "Client accepted";
  if (event.eventType === "signer_declined") return role === "owner" ? "You stopped the request for changes" : "Client requested changes";
  return EVENT_LABELS[event.eventType] || event.eventType.replaceAll("_", " ");
}

function NextActionCard({ contract, clientAcceptedAt, versionStatus, versionApproved, openComments, canFinalize, canOwnerAccept, canRestartAcceptance, busy, onAction, onFinalize, onAcceptOwn, onRestart, onEdit }: { contract: Contract; clientAcceptedAt: string | null; versionStatus: string | null; versionApproved: boolean; openComments: number; canFinalize: boolean; canOwnerAccept: boolean; canRestartAcceptance: boolean; busy: string | null; onAction: RunAction; onFinalize: () => void; onAcceptOwn: () => void; onRestart: () => void; onEdit: () => void }) {
  const client = contract.signers.find((signer) => signer.role === "client");
  let title = "Share for review, or finalize";
  let description = "Send the client a review link (step 1 below) to collect comments, or finalize this version when the terms are settled.";
  let actions: React.ReactNode = canFinalize ? <Button disabled={Boolean(busy)} onClick={onFinalize}><CheckCircle2 className="h-4 w-4" /> Finalize version</Button> : null;

  if (contract.status === "in_review") {
    title = versionApproved ? "Client is ready for the final version" : openComments ? `Resolve ${openComments} open comment${openComments === 1 ? "" : "s"}` : "Waiting on client review";
    description = versionApproved ? "They have no more comments. Finalize this exact version, then request their acceptance." : openComments ? "Reply, resolve, or edit a new version before finalizing." : "The client can comment from their review link. You can finalize whenever the terms are settled.";
  } else if (contract.status === "ready_to_sign") {
    title = "Request the client’s acceptance";
    description = "Rive emails the client their acceptance link for this finalized version. After they accept, you record your own acceptance here.";
    actions = <Button disabled={Boolean(busy)} onClick={() => void onAction("sign", `/api/workflow/contracts/${contract.id}/start-signing`)}><FileSignature className="h-4 w-4" /> Request client acceptance</Button>;
  } else if (contract.status === "starting") {
    title = "Preparing the acceptance request";
    description = "This normally takes a moment. If it does not finish, it resets automatically within 15 minutes so you can try again.";
    actions = <Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" /> Reload</Button>;
  } else if (contract.status === "signing" || (contract.status === "expired" && canOwnerAccept)) {
    if (canOwnerAccept) {
      title = "Your acceptance is next";
      description = `${client?.name || "The client"} accepted on ${formatDate(clientAcceptedAt)}. Record your acceptance to complete the Agreement and start its payment plan.`;
      actions = <Button disabled={Boolean(busy)} onClick={onAcceptOwn}><FileSignature className="h-4 w-4" /> Record your acceptance</Button>;
    } else {
      title = "Waiting for the client to accept";
      description = "Their acceptance link is in step 2 below. You will get a notification and an email as soon as they accept.";
      actions = null;
    }
  } else if (contract.status === "declined") {
    title = "Changes were requested";
    description = "Read the reason in the history, then edit the draft to save a new version and request acceptance again. Any acceptance already recorded stays attached to the earlier version.";
    actions = <Button disabled={Boolean(busy)} onClick={onEdit}><Pencil className="h-4 w-4" /> Edit draft</Button>;
  } else if (contract.status === "expired") {
    title = "The request expired";
    description = canRestartAcceptance
      ? "The client did not accept in time. Nothing was lost — send a fresh acceptance request for the same version, or edit the draft first."
      : versionStatus === "final"
        ? "Edit the draft to save a new version, then request acceptance again."
        : "The review link expired. Share a new review link below, or finalize this version.";
    actions = canRestartAcceptance
      ? <Button disabled={Boolean(busy)} onClick={onRestart}><Send className="h-4 w-4" /> Send a fresh acceptance request</Button>
      : canFinalize ? <Button disabled={Boolean(busy)} onClick={onFinalize}><CheckCircle2 className="h-4 w-4" /> Finalize version</Button> : <Button variant="outline" disabled={Boolean(busy)} onClick={onEdit}><Pencil className="h-4 w-4" /> Edit draft</Button>;
  } else if (contract.status === "executed") {
    const workReady = contract.work_setup.status === "succeeded";
    title = workReady ? "Agreement accepted — review billing drafts" : "Agreement accepted — set up the work";
    description = workReady ? "Eligible payment triggers create draft invoices only. Review each invoice before sending it to the client." : "Choose the linked Project and planning details before Rive activates the accepted billing plan.";
    actions = <>{workReady ? <Link href="/workflow/revenue" className={buttonVariants({ variant: "default" })}><CircleDollarSign className="h-4 w-4" /> Review invoices</Link> : <Link href="#work-setup" className={buttonVariants({ variant: "default" })}><ArrowRight className="h-4 w-4" /> Set up the work</Link>}<Button variant="outline" disabled={Boolean(busy)} onClick={() => void onAction("billing", `/api/workflow/contracts/${contract.id}/billing/run`)}><RefreshCw className="h-4 w-4" /> Check triggers</Button></>;
  } else if (contract.status === "void") {
    title = "This record is void";
    description = "Its immutable versions and evidence remain available. Create a replacement if the engagement continues.";
    actions = <Link className={buttonVariants({ variant: "default" })} href={`/workflow/contracts?new=1&clientId=${encodeURIComponent(contract.client.id)}${contract.project ? `&projectId=${encodeURIComponent(contract.project.id)}` : ""}`}><Plus className="h-4 w-4" /> Create replacement</Link>;
  }

  return <Card className="border-primary/20 bg-primary/[0.035]"><CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none bg-primary/10 text-primary"><ArrowRight className="h-4 w-4" /></span><div><Kicker>Next action</Kicker><h2 className="mt-0.5 text-base font-extrabold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>{actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}</CardContent></Card>;
}

/**
 * The only two public links an Agreement has, in the order they are used.
 * A link's URL is shown once (only its hash is stored); afterwards the panel
 * shows when the active link was created and expires, never the token.
 */
function ShareLinksCard({ clientName, clientEmail, status, canReview, clientSigner, clientAcceptedAt, activeReview, activeClientLink, freshReviewUrl, freshClientUrl, busy, onRequest, onCopy }: {
  clientName: string;
  clientEmail: string | null;
  status: string;
  canReview: boolean;
  clientSigner: Signer | null;
  clientAcceptedAt: string | null;
  activeReview: ReviewLink | null;
  activeClientLink: ReviewLink | null;
  freshReviewUrl: string;
  freshClientUrl: string;
  busy: string | null;
  onRequest: (kind: "review" | "client", sendEmail: boolean) => void;
  onCopy: (url: string) => void;
}) {
  const clientLinkUsable = status === "signing" && clientSigner?.status === "pending";
  const clientStepNote = clientAcceptedAt
    ? `${clientName} accepted on ${formatDate(clientAcceptedAt)}. No link is needed any more.`
    : clientLinkUsable
      ? null
      : "Available once you finalize the version and request acceptance.";
  return (
    <Card>
      <CardHeader><CardTitle>Client links</CardTitle><CardDescription>Your client uses at most two links, in this order. You never need a link yourself.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0 sm:pt-0">
        <ShareStep
          step={1}
          title="Review link — comments only"
          helper={`${clientName} can read the draft, comment, and tell you they are ready for the final version. It cannot record acceptance.`}
          active={activeReview}
          freshUrl={canReview ? freshReviewUrl : ""}
          note={canReview ? null : "Closed — this version has been finalized for acceptance."}
          busy={busy}
          canEmail={Boolean(clientEmail)}
          onGet={() => onRequest("review", false)}
          onEmail={() => onRequest("review", true)}
          onCopy={onCopy}
          enabled={canReview}
        />
        <ShareStep
          step={2}
          title="Acceptance link — send only to the client"
          helper={`Opens the finalized version so ${clientName} can record acceptance. You record yours here in Rive after they accept.`}
          active={clientLinkUsable ? activeClientLink : null}
          freshUrl={clientLinkUsable ? freshClientUrl : ""}
          note={clientStepNote}
          busy={busy}
          canEmail={Boolean(clientEmail)}
          onGet={() => onRequest("client", false)}
          onEmail={() => onRequest("client", true)}
          onCopy={onCopy}
          enabled={clientLinkUsable}
        />
      </CardContent>
    </Card>
  );
}

function ShareStep({ step, title, helper, active, freshUrl, note, busy, canEmail, onGet, onEmail, onCopy, enabled }: {
  step: number;
  title: string;
  helper: string;
  active: ReviewLink | null;
  freshUrl: string;
  note: string | null;
  busy: string | null;
  canEmail: boolean;
  onGet: () => void;
  onEmail: () => void;
  onCopy: (url: string) => void;
  enabled: boolean;
}) {
  return (
    <div className={`rounded-none border p-4 ${enabled ? "border-border" : "border-border bg-muted/30"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold"><span className="mr-2 font-mono text-xs text-muted-foreground">{step}</span>{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>
          {note ? <p className="mt-2 text-xs font-semibold">{note}</p> : null}
          {enabled && freshUrl ? (
            <div className="mt-2 rounded-none border border-primary/25 bg-primary/5 p-2">
              <a className="block break-all text-xs text-primary underline" href={freshUrl} target="_blank" rel="noreferrer">{freshUrl}</a>
              <p className="mt-1 text-[11px] text-muted-foreground">Copy it now — Rive stores only a fingerprint of the link and cannot show it again.</p>
            </div>
          ) : enabled && active ? (
            <p className="mt-2 text-xs text-muted-foreground">Active link created {formatDate(active.createdAt)} · expires {formatDate(active.expiresAt)}. To copy it again, get a new link (the current one stops working).</p>
          ) : enabled ? <p className="mt-2 text-xs text-muted-foreground">No active link.</p> : null}
        </div>
        {enabled ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {freshUrl ? <Button size="sm" variant="outline" onClick={() => onCopy(freshUrl)}><Copy className="h-3.5 w-3.5" /> Copy</Button> : null}
            <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={onGet}><Link2 className="h-3.5 w-3.5" /> {active || freshUrl ? "New link" : "Get link"}</Button>
            <Button size="sm" variant="ghost" disabled={Boolean(busy) || !canEmail} onClick={onEmail}><Send className="h-3.5 w-3.5" /> Email client</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Editor({ contract, title, setTitle, currency, setCurrency, governingLaw, setGoverningLaw, jurisdiction, setJurisdiction, sections, setSections, payments, setPayments, saving, onSave }: { contract: Contract; title: string; setTitle: (value: string) => void; currency: string; setCurrency: (value: string) => void; governingLaw: string; setGoverningLaw: (value: string) => void; jurisdiction: string; setJurisdiction: (value: string) => void; sections: Section[]; setSections: React.Dispatch<React.SetStateAction<Section[]>>; payments: PaymentDraft[]; setPayments: React.Dispatch<React.SetStateAction<PaymentDraft[]>>; saving: boolean; onSave: () => void }) {
  const move = (index: number, direction: -1 | 1) => setSections((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const updatePayment = (index: number, patch: Partial<PaymentDraft>) => setPayments((current) => current.map((payment, itemIndex) => itemIndex === index ? { ...payment, ...patch } : payment));
  const paymentProblem = payments.map((payment, index) => {
    if (!payment.label.trim() || Number(payment.amount) <= 0 || !Number.isFinite(Number(payment.amount))) return `Payment ${index + 1} needs a label and positive amount.`;
    const dueDays = Number(payment.dueDays);
    if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 365) return `Payment ${index + 1} needs a due period from 0 to 365 days.`;
    if (payment.triggerType === "fixed_date" && !payment.triggerDate) return `Payment ${index + 1} needs a trigger date.`;
    if (payment.triggerType.startsWith("milestone") && !payment.milestoneId) return `Payment ${index + 1} needs a milestone.`;
    if (payment.triggerType === "milestone_due" && !contract.project?.milestones?.find((milestone) => milestone.id === payment.milestoneId)?.dueDate) return `Payment ${index + 1} needs a milestone with a due date.`;
    return null;
  }).find(Boolean);
  const problem = !title.trim() ? "Agreement title is required." : !/^[A-Z]{3}$/.test(currency) ? "Use a valid three-letter currency." : !governingLaw.trim() ? "Governing law is required." : sections.some((section) => section.enabled && (!section.title.trim() || !section.body.trim())) ? "Every enabled clause needs a title and wording." : paymentProblem || null;
  return <Card className="border-primary/25"><CardHeader><CardTitle>Edit the current draft</CardTitle><CardDescription>Saving creates a new immutable version and revokes old review or acceptance links. Existing versions remain in history.</CardDescription></CardHeader><CardContent className="flex flex-col gap-5"><div className="grid gap-3 sm:grid-cols-3"><FormField className="sm:col-span-3" label="Agreement title" required><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} /></FormField><FormField label="Currency" required><Input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))} maxLength={3} /></FormField><FormField label="Governing law" required><Input value={governingLaw} onChange={(event) => setGoverningLaw(event.target.value)} /></FormField><FormField label="Jurisdiction"><Input value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} placeholder="Optional" /></FormField></div><div><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Clauses</h3><p className="text-xs text-muted-foreground">Required clauses stay enabled; custom terms can be added or reordered.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setSections((current) => [...current, { key: `custom-${Date.now()}-${current.length}`, title: "Custom clause", body: "Describe the agreed term.", enabled: true }])}><Plus className="h-3.5 w-3.5" /> Add clause</Button></div><div className="space-y-3">{sections.map((section, index) => <div key={section.key} className={`rounded-none border p-3 ${section.enabled ? "border-border" : "border-border bg-muted/30"}`}><div className="flex items-start gap-3"><input type="checkbox" checked={section.enabled} disabled={section.required} onChange={(event) => setSections((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} className="mt-3 h-4 w-4 accent-primary" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Input value={section.title} disabled={!section.enabled} onChange={(event) => setSections((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} className="font-semibold" /><Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon-sm" disabled={index === sections.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>{!section.required ? <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setSections((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-3.5 w-3.5" /></Button> : null}</div><Textarea rows={3} className="mt-2 leading-6" value={section.body} disabled={!section.enabled} onChange={(event) => setSections((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item))} /></div></div></div>)}</div></div><div className="rounded-none border border-border p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Payment plan</h3><p className="text-xs text-muted-foreground">Each trigger can create at most one draft invoice after acceptance.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setPayments((current) => [...current, { label: "", amount: "", currency, triggerType: "on_signing", triggerDate: "", dueDays: "7", milestoneId: "", invoiceDescription: "" }])}><Plus className="h-3.5 w-3.5" /> Add payment</Button></div>{payments.length === 0 ? <p className="text-xs text-muted-foreground">No automatic invoice schedule.</p> : <div className="space-y-3">{payments.map((payment, index) => <div key={index} className="rounded-none border border-border p-3"><div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Payment label" value={payment.label} onChange={(event) => updatePayment(index, { label: event.target.value })} /><Input type="number" min="0.01" step="0.01" placeholder={`Amount (${currency})`} value={payment.amount} onChange={(event) => updatePayment(index, { amount: event.target.value, currency })} /><Select value={payment.triggerType} onChange={(event) => updatePayment(index, { triggerType: event.target.value, milestoneId: "", triggerDate: "" })}><option value="on_signing">When both parties record acceptance</option><option value="milestone_completed">When milestone completes</option><option value="milestone_due">When milestone is due</option><option value="fixed_date">On fixed date</option></Select>{payment.triggerType === "fixed_date" ? <Input type="date" value={payment.triggerDate} onChange={(event) => updatePayment(index, { triggerDate: event.target.value })} /> : payment.triggerType.startsWith("milestone") ? <Select value={payment.milestoneId} onChange={(event) => updatePayment(index, { milestoneId: event.target.value })}><option value="">Choose milestone</option>{(contract.project?.milestones || []).map((milestone) => <option key={milestone.id} value={milestone.id} disabled={payment.triggerType === "milestone_due" && !milestone.dueDate}>{milestone.title}{payment.triggerType === "milestone_due" && !milestone.dueDate ? " · add a due date first" : ""}</option>)}</Select> : <div />}<Input type="number" min="0" max="365" value={payment.dueDays} onChange={(event) => updatePayment(index, { dueDays: event.target.value })} placeholder="Invoice due days" /><Input value={payment.invoiceDescription} onChange={(event) => updatePayment(index, { invoiceDescription: event.target.value })} placeholder="Invoice description (optional)" /></div><Button type="button" variant="ghost" size="sm" className="mt-2 text-destructive" onClick={() => setPayments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-3.5 w-3.5" /> Remove</Button></div>)}</div>}</div><div className="flex flex-col items-end gap-2">{problem ? <p className="text-xs font-semibold text-destructive">{problem}</p> : null}<Button disabled={saving || Boolean(problem)} onClick={onSave}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save as new version</Button></div></CardContent></Card>;
}

function PaymentPlan({ contract, busy, runAction }: { contract: Contract; busy: string | null; runAction: (key: string, url: string, method?: string, body?: unknown, preserveEditor?: boolean) => Promise<Record<string, unknown> | null> }) {
  return <section><h2 className="mb-2 text-sm font-bold">Payment plan</h2>{contract.payment_plan.length === 0 ? <p className="text-sm text-muted-foreground">No automatic invoice triggers. Billing remains manual.</p> : <div className="divide-y divide-border rounded-none border border-border">{contract.payment_plan.map((item) => <div key={item.id} className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{item.label} · <span className="font-mono tabular-nums">{item.currency} {Number(item.amount).toLocaleString(localeForCurrency(item.currency))}</span></p><p className="mt-0.5 text-xs text-muted-foreground">{formatTrigger(item)} · invoice due in {item.due_days} days</p>{item.occurrence?.invoice ? <Link href={`/workflow/revenue?invoiceId=${encodeURIComponent(item.occurrence.invoice.id)}`} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">{item.occurrence.invoice.invoiceNumber} · {item.occurrence.invoice.status}<ArrowRight className="h-3 w-3" /></Link> : item.occurrence?.status === "awaiting_work_setup" ? <p className="mt-1 text-xs text-primary">Waiting for work setup before this accepted trigger can draft an invoice.</p> : item.occurrence?.status === "eligible" ? <p className="mt-1 text-xs text-warning">Eligible — run a billing check if the draft has not appeared.</p> : null}</div><div className="flex flex-wrap items-center gap-2">{item.milestone ? <Button size="sm" variant={item.milestone.completed ? "secondary" : "outline"} disabled={Boolean(busy) || contract.status !== "executed"} onClick={() => item.milestone && void runAction(`milestone-${item.milestone.id}`, `/api/workflow/milestones/${item.milestone.id}`, "PATCH", { completed: !item.milestone.completed })}>{item.milestone.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{item.milestone.completed ? "Completed" : "Mark complete"}</Button> : null}<Badge variant={item.status === "draft_created" ? "success" : "outline"}>{item.status.replaceAll("_", " ")}</Badge></div></div>)}</div>}</section>;
}

function formatTrigger(item: { trigger_type?: string; trigger_date?: string | null; milestone?: { title: string } | null }) {
  if (item.trigger_type === "on_signing") return "When both parties record acceptance";
  if (item.trigger_type === "fixed_date") return item.trigger_date ? `On ${new Date(item.trigger_date).toLocaleDateString()}` : "On a fixed date";
  if (item.trigger_type === "milestone_due") return `${item.milestone?.title ? `When ${item.milestone.title} is due` : "When the milestone is due"}${item.trigger_date ? ` on ${new Date(item.trigger_date).toLocaleDateString()}` : ""}`;
  return `${item.trigger_type === "milestone_completed" ? "When complete" : "When due"}${item.milestone?.title ? ` · ${item.milestone.title}` : ""}`;
}
