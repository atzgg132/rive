"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@/components/ui";
import { AlertTriangle, CheckCircle2, FileText, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ReviewData = { mode: string; contract: { id: string; title: string; status: string; governing_law: string; jurisdiction: string | null; client_name: string; content: { ownerName?: string; ownerEmail?: string; clientName?: string; clientEmail?: string | null; clientCompany?: string | null; clientAddress?: string | null; projectTitle?: string | null; projectDescription?: string | null; governingLaw?: string; jurisdiction?: string | null; sections?: Array<{ key: string; title: string; body: string; enabled: boolean }>; paymentPlan?: { currency: string; items: Array<{ label: string; amount: string; currency: string; triggerType: string; triggerDate: string | null; dueDays: number; milestoneTitle: string | null }> } }; version: { number: number; status: string; hash: string; created_at: string }; comments: Array<{ id: string; authorRole: string; authorName: string; sectionKey: string | null; body: string; status: string; createdAt: string }>; expires_at: string } };

export default function ContractReviewPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [sectionKey, setSectionKey] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      const response = await fetch(`/api/public/contracts/review/${encodeURIComponent(token)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "This link is unavailable.");
      setData(payload);
      setAuthorName((current) => current || payload.contract.content.clientName || payload.contract.client_name || "");
      setAuthorEmail((current) => current || payload.contract.content.clientEmail || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "This link is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const approveReview = async () => {
    if (!token || approving) return;
    setApproving(true);
    try {
      const response = await fetch(`/api/public/contracts/review/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", authorName, authorEmail }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to approve this review.");
      toast.success(payload.message);
      await load();
    } catch (approvalError) {
      toast.error(approvalError instanceof Error ? approvalError.message : "Unable to approve this review.");
    } finally {
      setApproving(false);
    }
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [token]);

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !authorName.trim() || !body.trim() || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/public/contracts/review/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authorName, authorEmail, sectionKey: sectionKey || null, body }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to add comment.");
      setBody("");
      await load();
      toast.success("Comment added for the sender.");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Unable to add comment.");
    } finally { setSubmitting(false); }
  };

  if (loading) return <Centered><Loader2 className="h-6 w-6 animate-spin text-primary" /><span>Loading Agreement…</span></Centered>;
  if (error || !data) return <Centered><AlertTriangle className="h-8 w-8 text-amber-500" /><h1 className="text-xl font-bold">This review link is unavailable</h1><p className="max-w-md text-center text-sm text-muted-foreground">{error || "Ask the sender to create a new link."}</p></Centered>;
  const content = data.contract.content;
  const sections = (content.sections || []).filter((section) => section.enabled);
  const readOnly = data.mode === "read_only";

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-8"><div className="mx-auto flex max-w-5xl flex-col gap-6"><div className="flex items-center justify-between gap-3"><div className="text-2xl font-black tracking-tight">rive<span className="text-primary">.</span></div><div className="text-right text-xs text-muted-foreground">Agreement review link<br />Expires {new Date(data.contract.expires_at).toLocaleDateString()}</div></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>This is a review workspace, not a acceptance request.</strong> Read the complete version, ask questions in comments, and request changes from the sender. Do not record acceptance until you are satisfied with the final version.</p></div></div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{data.contract.version.status === "approved" ? "Review approved" : readOnly ? "Read-only Agreement" : "Draft for review"}</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight">{data.contract.title}</h1><p className="mt-2 text-sm text-muted-foreground">Between {content.ownerName || "the freelancer"} and {content.clientName || data.contract.client_name} · Version {data.contract.version.number} · Governing law: {content.governingLaw || data.contract.governing_law}{(content.jurisdiction ?? data.contract.jurisdiction) ? ` · ${content.jurisdiction ?? data.contract.jurisdiction}` : ""}</p>{(content.clientCompany || content.clientAddress) && <p className="mt-1 text-xs text-muted-foreground">{[content.clientCompany, content.clientAddress].filter(Boolean).join(" · ")}</p>}</div><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Agreement terms</CardTitle><CardDescription>Document hash: <span className="break-all font-mono text-[10px]">{data.contract.version.hash}</span></CardDescription></CardHeader><CardContent className="flex flex-col gap-5">{content.projectTitle && content.projectDescription && <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/20"><h2 className="mb-1 text-sm font-bold">Linked project brief snapshot</h2><p className="text-xs font-semibold text-primary">{content.projectTitle}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{content.projectDescription}</p></section>}{sections.map((section) => <section key={section.key} className="border-b border-border pb-5 last:border-0 last:pb-0"><h2 className="mb-2 text-sm font-bold">{section.title}</h2><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{section.body}</p></section>)}<section><h2 className="mb-2 text-sm font-bold">Payment plan</h2>{content.paymentPlan?.items?.length ? <div className="divide-y divide-border rounded-xl border border-border">{content.paymentPlan.items.map((item, index) => <div key={`${item.label}-${index}`} className="grid gap-1 p-3 text-sm sm:grid-cols-[1fr_auto]"><div><p className="font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{trigger(item)}</p></div><p className="font-bold">{item.currency} {item.amount}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No automatic payment plan attached.</p>}</section></CardContent></Card><div className="flex flex-col gap-6"><Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" /> Comments</CardTitle><CardDescription>Point to a section when asking for a change.</CardDescription></CardHeader><CardContent><div className="flex max-h-[430px] flex-col gap-3 overflow-y-auto">{data.contract.comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : data.contract.comments.map((comment) => <div key={comment.id} className={`rounded-xl border p-3 ${comment.status === "resolved" ? "border-border/60 bg-muted/30 opacity-75" : "border-border"}`}><div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold">{comment.authorName}</span><span className="text-muted-foreground">{comment.status === "resolved" ? "Resolved · " : ""}{new Date(comment.createdAt).toLocaleDateString()}</span></div>{comment.sectionKey && <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-primary">{comment.sectionKey}</p>}<p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{comment.body}</p></div>)}</div>{!readOnly && <form onSubmit={submitComment} className="mt-4 flex flex-col gap-2 border-t border-border pt-4"><Input value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder="Your name" required /><Input type="email" value={authorEmail} onChange={(event) => setAuthorEmail(event.target.value)} placeholder="Email (optional)" /><select value={sectionKey} onChange={(event) => setSectionKey(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm"><option value="">General comment</option>{sections.map((section) => <option key={section.key} value={section.key}>{section.title}</option>)}</select><Textarea value={body} onChange={(event) => setBody((event.target as HTMLTextAreaElement).value)} rows={4} placeholder="What would you like changed or clarified?" required /><Button type="submit" disabled={submitting || !authorName.trim() || !body.trim()}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />} Add comment</Button><div className="my-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground"><span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" /></div><Button type="button" variant="secondary" disabled={approving} onClick={() => void approveReview()}>{approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Looks good — ready for recorded acceptance</Button></form>}{data.contract.version.status === "approved" ? <div className="mt-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4 shrink-0" /><p>You marked this draft ready. The sender still needs to finalize the exact version and issue a separate recorded-acceptance request.</p></div> : null}</CardContent></Card><Card><CardContent className="flex flex-col gap-3 p-5 text-xs text-muted-foreground"><div className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /><p>Only the named client and workspace owner are acceptance parties. Rive does not accept this Agreement.</p></div><div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /><p>Ask the sender to issue a final version after comments are resolved.</p></div></CardContent></Card></div></div><p className="text-center text-xs text-muted-foreground">If you were not expecting this document, close this page and contact the sender through a trusted channel.</p></div></main>;
}

function trigger(item: { triggerType: string; triggerDate: string | null; milestoneTitle: string | null }) { if (item.triggerType === "on_signing") return "When both parties record acceptance"; if (item.triggerType === "fixed_date") return item.triggerDate ? `On ${new Date(item.triggerDate).toLocaleDateString()}` : "Fixed date"; if (item.triggerType === "milestone_due") return `${item.milestoneTitle ? `When ${item.milestoneTitle} is due` : "When the milestone is due"}${item.triggerDate ? ` on ${new Date(item.triggerDate).toLocaleDateString()}` : ""}`; return `${item.triggerType === "milestone_completed" ? "When complete" : "When due"}${item.milestoneTitle ? ` · ${item.milestoneTitle}` : ""}`; }
function Centered({ children }: { children: React.ReactNode }) { return <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">{children}</main>; }
