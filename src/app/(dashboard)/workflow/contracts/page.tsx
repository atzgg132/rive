"use client";

import {
  ContractComposer,
  type ContractComposerClient,
  type ContractComposerProject,
} from "@/components/contracts/ContractComposer";
import { Badge, Button, Card, CardContent, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileSignature,
  Loader2,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type ContractListItem = {
  id: string;
  title: string;
  status: string;
  provider: string;
  currency: string;
  updated_at: string;
  executed_at: string | null;
  client: { id: string; name: string; email: string | null };
  project: { id: string; title: string } | null;
  current_version: { version: number; contentHash: string; status: string } | null;
  signers: Array<{ role: string; status: string; signed_at: string | null }>;
  payment_plan: Array<{ id: string; label: string; amount: string; currency: string; trigger_type: string; status: string }>;
};

type ProjectListItem = ContractComposerProject & {
  contract_coverage?: "undecided" | "rive" | "external" | "none";
};

const statusMeta: Record<string, { label: string; description: string; badge: "default" | "secondary" | "outline" | "success" | "warning" | "destructive" }> = {
  draft: { label: "Draft", description: "Finish the terms, then share for review.", badge: "secondary" },
  in_review: { label: "In review", description: "Waiting for comments or client approval.", badge: "warning" },
  ready_to_sign: { label: "Ready for acceptance", description: "Final version is locked; start recorded acceptance.", badge: "default" },
  starting: { label: "Preparing acceptance", description: "The acceptance request is being prepared.", badge: "warning" },
  signing: { label: "Acceptance", description: "Acceptance is being collected in sequence.", badge: "default" },
  executed: { label: "Accepted", description: "Both parties recorded acceptance; payment triggers are active.", badge: "success" },
  declined: { label: "Changes requested", description: "A signer declined; revise and reissue.", badge: "destructive" },
  expired: { label: "Expired", description: "Reissue the review or acceptance request.", badge: "warning" },
  void: { label: "Void", description: "Retained for history; no longer active.", badge: "outline" },
};

const filters = [
  { value: "all", label: "All" },
  { value: "drafting", label: "Drafting", statuses: ["draft", "declined", "expired"] },
  { value: "review", label: "Review", statuses: ["in_review"] },
  { value: "signing", label: "Acceptance", statuses: ["ready_to_sign", "starting", "signing"] },
  { value: "executed", label: "Accepted", statuses: ["executed"] },
  { value: "void", label: "Void", statuses: ["void"] },
];

function nextAction(contract: ContractListItem): string {
  if (contract.status === "draft") return "Review draft";
  if (contract.status === "in_review") return "Open review workspace";
  if (contract.status === "ready_to_sign") return "Start recorded acceptance";
  if (contract.status === "signing") {
    const pending = contract.signers.find((signer) => signer.status !== "signed");
    return pending?.role === "client" ? "Waiting for client" : pending?.role === "owner" ? "Your acceptance is next" : "Track acceptance";
  }
  if (contract.status === "declined") return "Revise requested changes";
  if (contract.status === "expired") return "Reissue request";
  if (contract.status === "executed") return "View Agreement & invoices";
  return "View record";
}

export default function ContractsPage() {
  const router = useRouter();
  const queryConsumed = useRef(false);
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [clients, setClients] = useState<ContractComposerClient[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [initialClientId, setInitialClientId] = useState("");
  const [initialProjectId, setInitialProjectId] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [contractResponse, clientResponse, projectResponse] = await Promise.all([
        fetch("/api/workflow/contracts", { cache: "no-store" }),
        fetch("/api/workflow/clients", { cache: "no-store" }),
        fetch("/api/workflow/projects", { cache: "no-store" }),
      ]);
      const [contractData, clientData, projectData] = await Promise.all([
        contractResponse.json(),
        clientResponse.json(),
        projectResponse.json(),
      ]);
      if (!contractResponse.ok || !contractData.success) throw new Error(contractData.message || "Unable to load Agreements.");
      if (!clientResponse.ok || !clientData.success) throw new Error(clientData.message || "Unable to load clients.");
      if (!projectResponse.ok || !projectData.success) throw new Error(projectData.message || "Unable to load projects.");
      setContracts(contractData.contracts);
      setClients(clientData.clients.map((client: ContractComposerClient) => ({
        id: client.id,
        name: client.name,
        email: client.email || null,
        company: client.company || null,
        address: client.address || null,
        status: client.status,
      })));
      setProjects(projectData.projects.map((project: ProjectListItem) => ({
        ...project,
        budget: project.budget || null,
        milestones: project.milestones || [],
      })));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load the Agreements workspace.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial client-side workspace hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  useEffect(() => {
    if (loading || queryConsumed.current || typeof window === "undefined") return;
    queryConsumed.current = true;
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") !== "1") return;
    // Consume the cross-feature creation intent once after supporting records load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialClientId(url.searchParams.get("clientId") || "");
    setInitialProjectId(url.searchParams.get("projectId") || "");
    setComposerOpen(true);
    url.searchParams.delete("new");
    url.searchParams.delete("clientId");
    url.searchParams.delete("projectId");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [loading]);

  const openComposer = (clientId = "", projectId = "") => {
    setInitialClientId(clientId);
    setInitialProjectId(projectId);
    setComposerOpen(true);
  };

  const filteredContracts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const selectedFilter = filters.find((item) => item.value === filter);
    return contracts.filter((contract) => {
      const matchesFilter = !selectedFilter?.statuses || selectedFilter.statuses.includes(contract.status);
      const matchesSearch = !normalizedSearch || [contract.title, contract.client.name, contract.project?.title || ""].some((value) => value.toLowerCase().includes(normalizedSearch));
      return matchesFilter && matchesSearch;
    });
  }, [contracts, filter, search]);

  const counts = useMemo(() => ({
    action: contracts.filter((contract) => ["draft", "ready_to_sign", "declined", "expired"].includes(contract.status) || (contract.status === "signing" && contract.signers.find((signer) => signer.role === "owner")?.status !== "signed" && contract.signers.find((signer) => signer.role === "client")?.status === "signed")).length,
    review: contracts.filter((contract) => contract.status === "in_review").length,
    signing: contracts.filter((contract) => ["ready_to_sign", "starting", "signing"].includes(contract.status)).length,
    executed: contracts.filter((contract) => contract.status === "executed").length,
  }), [contracts]);

  const uncoveredProjects = useMemo(() => projects.filter((project) => !project.contract_coverage || project.contract_coverage === "undecided"), [projects]);

  return (
    <div className="workspace-page max-w-7xl animate-fade-in">
      <PageHeader
        title="Agreements"
        description="Draft, review, accept, and bill from one agreement using the client and project details already in Rive."
        actions={<Button onClick={() => openComposer()}><Plus className="h-4 w-4" /> New Agreement</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Sparkles} label="Needs your action" value={counts.action} tone="primary" />
        <SummaryCard icon={MessageSquareText} label="With clients" value={counts.review} tone="amber" />
        <SummaryCard icon={FileSignature} label="Acceptance" value={counts.signing} tone="blue" />
        <SummaryCard icon={FileCheck2} label="Accepted" value={counts.executed} tone="green" />
      </div>

      {uncoveredProjects.length > 0 ? (
        <Card className="border-primary/20 bg-primary/[0.035]">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-bold">{uncoveredProjects.length} active project{uncoveredProjects.length === 1 ? "" : "s"} need an Agreement decision</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Start with the existing client, brief, milestones, and currency. You can keep, remove, or rewrite every optional clause before sharing.</p>
              </div>
            </div>
            <Button variant="outline" className="shrink-0" onClick={() => { const project = uncoveredProjects[0]; openComposer(project.client_id || "", project.id); }} disabled={!uncoveredProjects[0]?.client_id}>
              Review projects
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search Agreements, clients, projects…" aria-label="Search Agreements" />
        </div>
        <Select value={filter} onChange={(event) => setFilter(event.target.value)} className="sm:w-44" aria-label="Filter Agreements by stage">
          {filters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Agreements…</div>
      ) : loadError ? (
        <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Agreements could not be loaded" description={loadError} action={<Button variant="outline" onClick={() => void load()}>Try again</Button>} />
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="h-5 w-5" />}
          title="Create the agreement before the work starts"
          description="Start with an existing client or project. Rive will reuse the brief, milestones, currency, and contact details while every term remains editable."
          action={<Button onClick={() => openComposer()}><Plus className="h-4 w-4" /> Create first Agreement</Button>}
        />
      ) : filteredContracts.length === 0 ? (
        <EmptyState icon={<Search className="h-5 w-5" />} title="No Agreements match" description="Try a different search or stage filter." action={<Button variant="outline" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredContracts.map((contract) => {
            const meta = statusMeta[contract.status] || { label: contract.status, description: "Open the Agreement record.", badge: "outline" as const };
            const signedCount = contract.signers.filter((signer) => signer.status === "signed").length;
            const paymentTotal = contract.payment_plan.reduce((sum, item) => sum + Number(item.amount), 0);
            return (
              <Link key={contract.id} href={`/workflow/contracts/${contract.id}`} className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/35 group-hover:shadow-lg">
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0"><h2 className="truncate text-base font-extrabold group-hover:text-primary">{contract.title}</h2><p className="mt-1 truncate text-xs text-muted-foreground">{contract.client.name}{contract.project ? ` · ${contract.project.title}` : " · Standalone agreement"}</p></div>
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                    </div>
                    <div className="rounded-xl bg-muted/45 px-3 py-2.5"><p className="text-xs font-bold">{nextAction(contract)}</p><p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{meta.description}</p></div>
                    <div className="mt-auto grid grid-cols-3 gap-3 border-t border-border pt-4 text-xs">
                      <Metric icon={Users} value={`${signedCount}/2`} label="accepted" />
                      <Metric icon={Clock3} value={`v${contract.current_version?.version || 1}`} label={new Date(contract.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                      <Metric icon={CircleDollarSign} value={contract.payment_plan.length ? `${contract.currency} ${paymentTotal.toLocaleString()}` : "Manual"} label={contract.payment_plan.length ? `${contract.payment_plan.length} trigger${contract.payment_plan.length === 1 ? "" : "s"}` : "billing"} />
                    </div>
                    <span className="inline-flex items-center justify-end gap-1 text-xs font-bold text-primary opacity-70 transition group-hover:opacity-100">Open Agreement <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <ContractComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        clients={clients}
        projects={projects}
        sourceContracts={contracts.map((contract) => ({ id: contract.id, title: contract.title, client: { name: contract.client.name } }))}
        initialClientId={initialClientId}
        initialProjectId={initialProjectId}
        onCreated={(contractId) => router.push(`/workflow/contracts/${contractId}`)}
      />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof FileSignature; label: string; value: number; tone: "primary" | "amber" | "blue" | "green" }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  };
  return <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-4 w-4" /></span><div><p className="text-xl font-extrabold leading-none">{value}</p><p className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</p></div></div>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) {
  return <div className="min-w-0"><p className="flex items-center gap-1.5 truncate font-bold"><Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{value}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{label}</p></div>;
}
