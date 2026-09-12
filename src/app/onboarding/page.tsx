"use client";

import { Button, Input, Kicker, Select, Textarea } from "@/components/ui";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Globe2,
  Link2,
  Loader2,
  Rocket,
  Sparkles,
  Upload,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import RiveLogo from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StartEngagementComposer } from "@/components/engagements/StartEngagementComposer";

type ImportPreview = {
  name: string;
  entity: "clients" | "projects" | "invoices" | "expenses" | "unknown";
  rows: number;
  headers: string[];
  warning: string | null;
};

type ImportReport = {
  clients: number;
  projects: number;
  invoices: number;
  expenses: number;
  skipped: number;
  unresolvedLinks: number;
};

type OnboardingConnection = {
  id: string;
  provider: string;
  accountEmail: string | null;
  status: string;
  lastSyncedAt: string | null;
};

type BusinessConnection = {
  id: string;
  provider: string;
  accountLabel: string | null;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};

type ImportJobSummary = {
  id: string;
  source: string;
  sourceLabel: string | null;
  status: string;
  totalRows: number;
  createdRecords: number;
  skippedRecords: number;
  unresolvedCount: number;
  createdAt: string;
  rolledBackAt: string | null;
  files: { id: string; name: string; entity: string; rowCount: number }[];
};

function normalizeSourceSelection(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const sources = values.filter((value): value is string => typeof value === "string");
  return sources.includes("starting_fresh") ? ["starting_fresh"] : Array.from(new Set(sources));
}

const BUSINESS_TYPES = [
  {
    id: "freelancer",
    label: "Freelancer",
    detail: "I run my own client work.",
    icon: UserRound,
  },
  {
    id: "studio",
    label: "Studio / agency",
    detail: "A small team delivers services.",
    icon: Building2,
  },
  {
    id: "consultant",
    label: "Consultant",
    detail: "Expertise and advisory work.",
    icon: BriefcaseBusiness,
  },
  {
    id: "contractor",
    label: "Contractor",
    detail: "I deliver work through contracts or engagements.",
    icon: BriefcaseBusiness,
  },
  {
    id: "creator",
    label: "Creator",
    detail: "Content, partnerships, and gigs.",
    icon: Sparkles,
  },
  {
    id: "small_business",
    label: "Small business",
    detail: "Operations beyond solo work.",
    icon: WalletCards,
  },
];
export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [businessTypes, setBusinessTypes] = useState<string[]>(["freelancer"]);
  const [currency, setCurrency] = useState("INR");
  const [timeZone, setTimeZone] = useState("Asia/Calcutta");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [path, setPath] = useState<"import" | "quickstart" | "clean">("quickstart");
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<ImportPreview[]>([]);
  const [importJobId, setImportJobId] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [connections, setConnections] = useState<OnboardingConnection[]>([]);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [zohoAvailable, setZohoAvailable] = useState(false);
  const [businessConnections, setBusinessConnections] = useState<BusinessConnection[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJobSummary[]>([]);
  // When the migration engine is live it owns importing entirely; this step
  // hands over to it instead of offering a second importer beside it.
  const [migrationEngine, setMigrationEngine] = useState(false);
  const [engagementFlow, setEngagementFlow] = useState(false);
  const [agreementsAvailable, setAgreementsAvailable] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/onboarding");
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error(data.message || "Your setup could not be loaded.");
        setLoading(false);
        return;
      }
      setName(data.user.name || "");
      setProfession(data.user.profession || "");
      setBusinessTypes(
        Array.isArray(data.user.businessTypes) && data.user.businessTypes.length
          ? data.user.businessTypes
          : data.user.businessType
            ? [data.user.businessType]
            : ["freelancer"],
      );
      setCurrency(
        data.user.currency === "USD" &&
          Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Calcutta"
          ? "INR"
          : data.user.currency || "USD",
      );
      setTimeZone(
        data.user.timeZone === "UTC"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
          : data.user.timeZone,
      );
      setAvatarUrl(data.user.avatarUrl || "");
      const connectorAvailability = data.connectorAvailability || {};
      const nextGoogleAvailable = connectorAvailability.googleCalendar === true;
      const nextZohoAvailable = connectorAvailability.zohoBooks === true;
      setMigrationEngine(data.featureAvailability?.migrationEngine === true);
      setEngagementFlow(data.featureAvailability?.engagementFlow === true);
      setAgreementsAvailable(data.featureAvailability?.agreements === true);
      const savedSources = normalizeSourceSelection(data.user.onboardingData?.sources);
      setSources(savedSources.filter((source) => source !== "google_calendar" || nextGoogleAvailable));
      const savedPath = data.user.onboardingData?.startingPath;
      if (["import", "quickstart", "clean"].includes(savedPath)) setPath(savedPath as "import" | "quickstart" | "clean");
      setConnections(data.connections || []);
      setBusinessConnections(data.businessConnections || []);
      setGoogleAvailable(nextGoogleAvailable);
      setZohoAvailable(nextZohoAvailable);
      const jobsResponse = await fetch("/api/onboarding/import/jobs");
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        setImportJobs(jobsData.jobs || []);
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get("connected") === "google")
        toast.success(
          "Google Calendar connected. Your existing schedule is now in Rive.",
        );
      if (params.get("connected") === "zoho_books")
        toast.success(
          "Zoho Books connected. Review the organization before importing records.",
        );
      if (params.get("connectionError"))
        toast.error(
          params.get("connectionError") === "google_access_denied"
            ? "The Google connection was cancelled — no access was granted."
            : "Google Calendar could not be connected. You can continue and try again later.",
        );
      const restarting = params.get("restart") === "1";
      const focus = params.get("focus");
      if (
        !restarting &&
        ["complete", "skipped"].includes(data.user.onboardingStatus)
      ) {
        router.replace("/dashboard");
        return;
      }
      if (focus === "goal") setStep(0);
      else if (focus === "import") {
        setPath("import");
        setStep(3);
      } else {
        const savedStep = Number(data.user.onboardingStep) || 0;
        setStep(restarting || savedStep < 2 ? 0 : Math.min(savedStep, 3));
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  const progress = useMemo(() => {
    const stage = step === 0 ? 0 : step === 2 ? 1 : step === 3 ? 2 : 3;
    return Math.round(((stage + 1) / 4) * 100);
  }, [step]);
  const onboardingStage = step === 0 ? 0 : step === 2 ? 1 : step === 3 ? 2 : 3;
  const googleConnection = connections.find(
    (connection) => googleAvailable && connection.provider === "google",
  );
  const zohoConnection = businessConnections.find(
    (connection) => zohoAvailable && connection.provider === "zoho_books",
  );

  async function saveProfile() {
    if (!name.trim())
      return toast.error("Add your name to continue. Everything else on this step is optional.");
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ...(profession.trim() ? { profession } : {}),
          ...(businessTypes.length > 0 ? { businessTypes } : {}),
          currency,
          timeZone,
          avatarUrl,
          goal: "organize",
          step: 2,
          status: "in_progress",
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Profile could not be saved.");
      setStep(2);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Profile could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveSourcesAndContinue() {
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: path === "import" ? "migrate" : "organize", sources, startingPath: path, step: 3, status: "in_progress" }),
      });
      if (!response.ok)
        throw new Error("Your starting point could not be saved.");
      if (path === "clean") {
        await startClean();
        return;
      }
      setStep(3);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Your starting point could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleSource(source: string) {
    setSources((current) => {
      if (source === "starting_fresh") {
        return current.includes(source) ? [] : [source];
      }
      return current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current.filter((item) => item !== "starting_fresh"), source];
    });
  }

  async function runImport(mode: "preview" | "commit") {
    if (!files.length)
      return toast.error("Choose at least one CSV or XLSX export.");
    setSaving(true);
    try {
      const form = new FormData();
      form.set("mode", mode);
      if (importJobId) form.set("jobId", importJobId);
      files.forEach((file) => form.append("files", file));
      const response = await fetch("/api/onboarding/import", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Import could not be processed.");
      if (mode === "preview") {
        setPreview(data.preview || []);
        setImportJobId(data.jobId || "");
        toast.success("Files analyzed. Review them before importing.");
      } else {
        setReport(data.report);
        const jobsResponse = await fetch("/api/onboarding/import/jobs");
        if (jobsResponse.ok)
          setImportJobs((await jobsResponse.json()).jobs || []);
        setStep(4);
        toast.success("Your workspace is ready.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Import could not be processed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createQuickstart(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "quickstart",
          clientName,
          clientEmail,
          projectTitle,
          projectDescription,
          dueDate,
          invoiceAmount,
          currency,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Your workflow could not be created.");
      setReport({
        clients: 1,
        projects: 1,
        invoices: data.result.invoice ? 1 : 0,
        expenses: 0,
        skipped: 0,
        unresolvedLinks: 0,
      });
      setStep(4);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Your workflow could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function startClean() {
    setSaving(true);
    const response = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "complete", goal: "organize", startingPath: "clean", step: 5 }),
    });
    setSaving(false);
    if (!response.ok) return toast.error("Setup could not be completed.");
    router.replace("/dashboard");
  }

  function choosePath(nextPath: "import" | "quickstart" | "clean") {
    setPath(nextPath);
    void fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: nextPath === "import" ? "migrate" : "organize", startingPath: nextPath, step: 2, status: "in_progress" }),
    }).catch(() => undefined);
  }

  async function skipSetup() {
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete", startingPath: "skipped", step: 5 }),
      });
      if (!response.ok) throw new Error("Setup could not be skipped.");
      router.replace("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup could not be skipped.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="bottom-right" theme="system" />
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-5 sm:px-8">
          <RiveLogo height={26} />
          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-medium text-muted-foreground sm:block">
              {progress}% workspace ready
            </span>
          <div className="hidden h-1 w-28 overflow-hidden rounded-none bg-muted sm:block">
            <div
              className="h-full rounded-none bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void skipSetup()}
            disabled={saving}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Skip setup
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <div className="h-1 bg-muted sm:hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      <main className="mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-start gap-8 px-4 py-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8 lg:py-12">
        <aside className="hidden lg:block">
          <Kicker>Workspace launch</Kicker>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.035em]">
            Start with momentum, not an empty dashboard.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            rive. turns what you already know—and what you already have—into a
            connected operating system.
          </p>
          <div className="mt-8 space-y-3">
            {[
              "Essentials",
              "Choose a starting path",
              "Create real context",
              "Workspace ready",
            ].map((label, index) => (
              <div
                key={label}
                className={`flex items-center gap-3 text-xs font-bold ${onboardingStage > index ? "text-success" : onboardingStage === index ? "border-l-2 border-primary bg-accent pl-2 text-primary" : "text-muted-foreground"}`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full border text-[.75rem] font-extrabold ${onboardingStage > index ? "border-success bg-success text-success-foreground" : onboardingStage === index ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                >
                  {onboardingStage > index ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                {label}
              </div>
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded-none border border-border bg-card">
          {step === 0 && (
            <div className="p-6 sm:p-9">
              <div className="max-w-2xl">
                <Kicker>One quick setup</Kicker>
                <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  What kind of work do you run?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  We inherited your name from signup and detected your regional defaults. What you do and how you work only tune guidance — invoicing never waits on them.
                </p>
              </div>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-none border border-border bg-muted/40 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Signed in as</p>
                    <p className="mt-1 text-sm font-black">{name}</p>
                  </div>
                  <label>
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                      What do you do? <span className="font-medium normal-case tracking-normal text-muted-foreground">optional</span>
                    </span>
                    <Input
                      value={profession}
                      onChange={(event) => setProfession(event.target.value)}
                      placeholder="Product designer, CA, filmmaker…"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Default currency
                    </span>
                    <Select
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                    >
                      {[
                        "INR",
                        "USD",
                        "EUR",
                        "GBP",
                        "AUD",
                        "CAD",
                        "SGD",
                        "AED",
                      ].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Timezone
                    </span>
                    <Input
                      value={timeZone}
                      onChange={(event) => setTimeZone(event.target.value)}
                    />
                  </label>
              </div>
              <div className="mt-7">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">
                  How do you work? Choose all that apply, or skip this.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {BUSINESS_TYPES.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        data-testid="onboarding-business-type-card"
                        aria-pressed={businessTypes.includes(item.id)}
                        onClick={() => setBusinessTypes((current) => current.includes(item.id) ? current.filter((value) => value !== item.id) : [...current, item.id])}
                        className={`flex min-h-28 min-w-0 items-start justify-start gap-2 rounded-none border p-3 text-left whitespace-normal ${businessTypes.includes(item.id) ? "border-primary bg-accent" : "border-border"}`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0">
                          <p className="text-xs font-black leading-4">{item.label}</p>
                          <p className="mt-1 text-xs leading-4 text-muted-foreground">{item.detail}</p>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-7 flex justify-end">
                <Button
                  onClick={saveProfile}
                  disabled={saving}
                  variant="default"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Continue <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-6 sm:p-9">
              <Kicker>Choose how to begin</Kicker>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                Start with the fastest path to useful context.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Start one real client engagement, import existing records, or explore an empty workspace. You can use every tool later.
              </p>
              <div className="hidden">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Where is your business information today? <span className="normal-case tracking-normal font-semibold">Select all existing sources, or choose one fresh start.</span>
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["spreadsheets", "Spreadsheets / CSV"],
                    ["zoho_books", "Zoho Books export"],
                    ["quickbooks", "QuickBooks export"],
                    ["xero", "Xero export"],
                    ["freshbooks", "FreshBooks export"],
                    ...(googleAvailable ? [["google_calendar", "Google Calendar"]] : []),
                    ["project_tool", "Project tool"],
                    ["starting_fresh", "Mostly starting fresh"],
                  ].map(([id, label]) => (
                    <Button
                      key={id}
                      type="button"
                      aria-pressed={sources.includes(id)}
                      aria-label={id === "starting_fresh" ? `${label} (choose instead of existing sources)` : label}
                      onClick={() => toggleSource(id)}
                      className={`flex items-center justify-between rounded-none border px-3.5 py-3 text-left text-xs font-bold ${sources.includes(id) ? "border-primary bg-accent text-foreground" : "border-border text-muted-foreground"}`}
                    >
                      <span>{label}</span>
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full border ${sources.includes(id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                      >
                        {sources.includes(id) && <Check className="h-3 w-3" />}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
              {googleAvailable && (
                <div
                  className={`hidden mt-7 flex-col gap-4 rounded-none border p-5 sm:flex-row sm:items-center sm:justify-between ${googleConnection?.status === "connected" ? "border-success/30 bg-success/10" : "border-primary/25 bg-primary/10"}`}
                >
                  <div className="flex min-w-0 gap-4">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-none ${googleConnection?.status === "connected" ? "bg-success text-success-foreground" : "bg-muted text-primary"}`}
                    >
                      {googleConnection?.status === "connected" ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <CalendarDays className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black">Google Calendar</p>
                        <span className="rounded-full border border-current/15 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-primary">
                          Live connector
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {googleConnection?.status === "connected"
                          ? `${googleConnection.accountEmail || "Google account"} connected · events and updates sync both ways.`
                          : googleConnection
                            ? "This Google connection needs attention — reconnect it from the calendar to resume sync."
                            : "Import existing calendars and events now. New Rive events can sync back to Google."}
                      </p>
                    </div>
                  </div>
                  {googleConnection?.status === "connected" ? (
                    <a
                      href="/calendar"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-none border border-border bg-card px-4 py-2.5 text-xs font-black text-success"
                    >
                      Review calendars <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  ) : googleAvailable ? (
                    <a
                      href="/api/calendar/connections/google/start?from=onboarding"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-none bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {googleConnection ? "Reconnect Google" : "Connect Google"}
                    </a>
                  ) : null}
                </div>
              )}
              {zohoAvailable && (
                <div
                  className={`hidden mt-4 flex-col gap-4 rounded-none border p-5 sm:flex-row sm:items-center sm:justify-between ${zohoConnection?.status === "connected" ? "border-success/30 bg-success/10" : "border-info/25 bg-info/10"}`}
                >
                  <div className="flex min-w-0 gap-4">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-none ${zohoConnection?.status === "connected" ? "bg-success text-success-foreground" : "bg-muted text-info"}`}
                    >
                      {zohoConnection?.status === "connected" ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <BookOpen className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black">Zoho Books</p>
                        <span className="rounded-full border border-current/15 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-info">
                          {zohoConnection ? "Connected" : "OAuth ready"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {zohoConnection
                          ? `${zohoConnection.accountLabel || "Zoho organization"} is connected. Rive will ask for confirmation before importing financial records.`
                            : "Connect securely to verify your organization. Record import stays disabled until the import review flow is production-ready."}
                      </p>
                    </div>
                  </div>
                  {zohoConnection ? (
                    <span className="inline-flex shrink-0 items-center justify-center rounded-none border border-border bg-card px-4 py-2.5 text-xs font-black text-success">
                      Organization ready
                    </span>
                  ) : zohoAvailable ? (
                    <a
                      href="/api/connectors/zoho-books/start?from=onboarding"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-none bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Connect Zoho
                    </a>
                  ) : null}
                </div>
              )}
              <div className="mt-7">
                <Kicker tone="muted">Choose one starting path</Kicker>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  {[
                    {
                      id: "quickstart" as const,
                      icon: Rocket,
                      title: "New client work",
                      detail:
                        "Create the client and work as one connected flow, with optional milestones, Agreement, and invoice.",
                      badge: "Recommended",
                    },
                    {
                      id: "import" as const,
                      icon: FileSpreadsheet,
                      title: "Import my work",
                      detail:
                        "Bring existing client, project, invoice, and expense records into Rive.",
                      badge: "For switching",
                    },
                    {
                      id: "clean" as const,
                      icon: Sparkles,
                      title: "Explore Rive",
                      detail:
                        "Enter an empty workspace with a contextual activation checklist.",
                      badge: "No sample data",
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        aria-pressed={path === item.id}
                        onClick={() => choosePath(item.id)}
                        className={`relative flex min-h-40 min-w-0 flex-col items-start justify-start whitespace-normal rounded-none border p-5 text-left ${path === item.id ? "border-primary bg-accent" : "border-border"}`}
                      >
                        <span className="absolute right-3 top-3 rounded-full bg-muted px-2 py-1 text-xs font-black uppercase text-primary">
                          {item.badge}
                        </span>
                        <Icon className="h-6 w-6 shrink-0 text-primary" />
                        <p className="mt-8 text-sm font-black">{item.title}</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {item.detail}
                        </p>
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-7 flex justify-between">
                <Button
                  onClick={() => setStep(0)}
                  variant="ghost"
                  className="text-xs"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={() => void saveSourcesAndContinue()}
                  disabled={saving}
                  variant="default"
                >
                  {path === "clean" ? "Open my workspace" : "Continue"}{" "}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && path === "import" && migrationEngine && (
            <div className="p-6 sm:p-9">
              <Kicker>Migration</Kicker>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Bring your business into Rive.
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Upload the client, project, invoice, and expense exports you
                already have, in any order. Rive works out what each file holds,
                reconnects the records to each other, and shows you exactly what
                it will create before anything is written.
              </p>
              <Button
                variant="default"
                className="mt-7 w-full sm:w-auto"
                onClick={() => router.push("/migrate")}
              >
                Start importing
              </Button>
              <button
                type="button"
                onClick={() => setPath("quickstart")}
                className="mt-4 block text-xs font-bold text-muted-foreground underline-offset-4 hover:underline"
              >
                I would rather start with one client instead
              </button>
            </div>
          )}

          {step === 3 && path === "import" && !migrationEngine && (
            <div className="p-6 sm:p-9">
              <Kicker>Migration studio</Kicker>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Preview your records before bringing them across.
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Upload separate client, project, invoice, or expense exports
                together. Rive detects them, previews the result, and preserves
                where every record came from. Imported records remain in your
                workspace after commit.
              </p>
              <label className="mt-7 flex cursor-pointer flex-col items-center rounded-none border-2 border-dashed border-primary/30 bg-primary/[0.05] px-5 py-10 text-center hover:border-primary">
                <Upload className="h-8 w-8 text-primary" />
                <p className="mt-3 text-sm font-black">
                  Choose up to six CSV or XLSX files
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  2 MB each · clients, projects, invoices, and expenses
                </p>
                <Input
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    setFiles(Array.from(event.target.files || []).slice(0, 6));
                    setPreview([]);
                    setImportJobId("");
                  }}
                />
              </label>
              {files.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {files.map((file) => (
                    <span
                      key={`${file.name}-${file.size}`}
                      className="rounded-full border border-border px-2.5 py-1 text-xs font-bold text-muted-foreground"
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              )}
              {preview.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-none border border-border">
                  <div className="grid grid-cols-[1fr_100px_70px] bg-muted px-4 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                    <span>File</span>
                    <span>Detected as</span>
                    <span>Rows</span>
                  </div>
                  {preview.map((item) => (
                    <div
                      key={item.name}
                      className="grid grid-cols-[1fr_100px_70px] border-t border-border px-4 py-3 text-xs"
                    >
                      <span className="truncate font-bold">{item.name}</span>
                      <span
                        className={
                          item.entity === "unknown"
                            ? "font-bold text-destructive"
                            : "font-bold text-primary"
                        }
                      >
                        {item.entity}
                      </span>
                      <span className="font-mono tabular-nums">{item.rows}</span>
                      {item.warning && (
                        <span className="col-span-3 mt-1 text-xs text-destructive">
                          {item.warning}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {importJobs.some((job) =>
                ["completed", "completed_with_issues", "rolled_back"].includes(
                  job.status,
                ),
              ) && (
                <div className="mt-6 rounded-none border border-border p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Recent migrations
                  </p>
                  <div className="mt-3 space-y-2">
                    {importJobs
                      .filter((job) =>
                        [
                          "completed",
                          "completed_with_issues",
                          "rolled_back",
                        ].includes(job.status),
                      )
                      .slice(0, 3)
                      .map((job) => (
                        <div
                          key={job.id}
                          className="flex flex-col gap-3 rounded-none bg-muted p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-xs font-black">
                              {job.files.map((file) => file.name).join(", ") ||
                                job.sourceLabel ||
                                job.source}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {job.createdRecords} created ·{" "}
                              {job.skippedRecords} skipped ·{" "}
                              {job.unresolvedCount} need review
                            </p>
                          </div>
                          <span className="text-xs font-black uppercase text-muted-foreground">
                            {job.status === "rolled_back" ? "Rolled back" : "Imported"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div className="mt-7 flex flex-wrap justify-between gap-3">
                <Button
                  onClick={() => setStep(2)}
                  variant="ghost"
                  className="text-xs"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Choose another path
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={() => runImport("preview")}
                    disabled={saving || !files.length}
                    variant="outline"
                    className="text-xs"
                  >
                    Analyze files
                  </Button>
                  <Button
                    onClick={() => runImport("commit")}
                    disabled={
                      saving ||
                      !preview.length ||
                      preview.some((item) => item.entity === "unknown")
                    }
                    variant="default"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Import workspace
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && path === "quickstart" && engagementFlow && (
            <div className="p-3 sm:p-6">
              <StartEngagementComposer
                entryPoint="onboarding"
                currency={currency}
                agreementsAvailable={agreementsAvailable}
                onCreated={(result) => router.replace(result.nextAction.href)}
              />
              <Button
                type="button"
                onClick={() => setStep(2)}
                variant="ghost"
                className="mt-4 text-xs"
              >
                <ArrowLeft className="h-4 w-4" />
                Choose another path
              </Button>
            </div>
          )}

          {step === 3 && path === "quickstart" && !engagementFlow && (
            <form onSubmit={createQuickstart} className="p-6 sm:p-9">
              <Kicker>One connected workflow</Kicker>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Start with work you are actually doing.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                One submission creates the relationship, the work, its calendar
                deadline, and an optional draft invoice.
              </p>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Client name
                  </span>
                  <Input
                    required
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Client email
                  </span>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Project
                  </span>
                  <Input
                    required
                    value={projectTitle}
                    onChange={(event) => setProjectTitle(event.target.value)}
                    placeholder="Website redesign, monthly accounting…"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    What are you delivering?
                  </span>
                  <Textarea
                    rows={3}
                    value={projectDescription}
                    onChange={(event) =>
                      setProjectDescription(event.target.value)
                    }
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Deadline
                  </span>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="font-mono tabular-nums"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    draft invoice value ({currency})
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceAmount}
                    onChange={(event) => setInvoiceAmount(event.target.value)}
                    className="font-mono tabular-nums"
                  />
                </label>
              </div>
              <div className="mt-7 flex justify-between">
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  variant="ghost"
                  className="text-xs"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Choose another path
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  variant="default"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}create
                  my workspace
                </Button>
              </div>
            </form>
          )}

          {step === 4 && (
            <div className="inverse-block p-7 text-center sm:p-12">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-none bg-background text-success">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.16em]">
                Workspace activated
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">
                You are opening rive. with context.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6">
                Your imported work now powers the dashboard, financial insights,
                calendar deadlines, and future portfolio draft.
              </p>
              {report && (
                <div className="mx-auto mt-7 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    ["clients", "projects", "invoices", "expenses"] as const
                  ).map((key) => (
                    <div
                      key={key}
                      className="rounded-none border border-background/30 p-4"
                    >
                      <p className="font-mono text-2xl font-semibold tabular-nums">{report[key]}</p>
                      <p className="mt-1 text-xs font-black uppercase tracking-wider opacity-70">
                        {key}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {report?.unresolvedLinks ? (
                <p className="mt-4 text-xs font-bold">
                  {report.unresolvedLinks} relationships need manual review.
                </p>
              ) : null}
              <Button
                onClick={() => router.replace("/dashboard")}
                variant="default"
                className="mt-8"
              >
                Open my operating system <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="mt-5 flex justify-center gap-5 text-xs font-bold opacity-70">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Deadlines connected
                </span>
                <span className="inline-flex items-center gap-1">
                  <Globe2 className="h-3.5 w-3.5" />
                  Portfolio prefill ready
                </span>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
