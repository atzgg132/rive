"use client";

import { Button, Input, Textarea, Select } from "@/components/ui";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  Receipt,
  Rocket,
  Sparkles,
  Upload,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import RiveLogo from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { uploadImage } from "@/utils/clientUploads";

/* User uploads are validated data URLs or remote hosts unavailable to a static image allowlist. */
/* eslint-disable @next/next/no-img-element */

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

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-950";
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
const GOALS = [
  {
    id: "organize",
    title: "Organize client work",
    detail: "Projects, deadlines, and tasks in one system.",
    icon: BriefcaseBusiness,
  },
  {
    id: "get_paid",
    title: "Get paid faster",
    detail: "Invoices, due dates, and collections.",
    icon: WalletCards,
  },
  {
    id: "understand_finances",
    title: "Understand my numbers",
    detail: "Profit, expenses, and business signals.",
    icon: Receipt,
  },
  {
    id: "publish_portfolio",
    title: "Publish proof of work",
    detail: "Create a portfolio from what rive. knows.",
    icon: Globe2,
  },
  {
    id: "migrate",
    title: "Move from another tool",
    detail: "Bring existing business data with you.",
    icon: FileSpreadsheet,
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [goal, setGoal] = useState("organize");
  const [sources, setSources] = useState<string[]>([]);
  const [path, setPath] = useState<"import" | "quickstart" | "clean">("import");
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
      setGoal(data.user.onboardingData?.goal || "organize");
      const connectorAvailability = data.connectorAvailability || {};
      const nextGoogleAvailable = connectorAvailability.googleCalendar === true;
      const nextZohoAvailable = connectorAvailability.zohoBooks === true;
      setMigrationEngine(data.featureAvailability?.migrationEngine === true);
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
          "Google Calendar could not be connected. You can continue and try again later.",
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
      if (focus === "goal") setStep(1);
      else if (focus === "import") {
        setPath("import");
        setStep(3);
      } else setStep(restarting ? 0 : Math.min(data.user.onboardingStep || 0, 3));
      setLoading(false);
    }
    void load();
  }, [router]);

  const progress = useMemo(
    () => Math.min(100, Math.round(((Math.min(step, 3) + 1) / 4) * 100)),
    [step],
  );
  const googleConnection = connections.find(
    (connection) => googleAvailable && connection.provider === "google",
  );
  const zohoConnection = businessConnections.find(
    (connection) => zohoAvailable && connection.provider === "zoho_books",
  );

  async function saveProfile() {
    if (!name.trim() || !profession.trim() || businessTypes.length === 0)
      return toast.error("Add your name, what you do, and at least one work type.");
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          profession,
          businessTypes,
          currency,
          timeZone,
          avatarUrl,
          step: 1,
          status: "in_progress",
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Profile could not be saved.");
      setStep(1);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Profile could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveGoal() {
    setSaving(true);
    const response = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, step: 2, status: "in_progress" }),
    });
    setSaving(false);
    if (!response.ok) return toast.error("Your goal could not be saved.");
    setStep(2);
  }

  async function saveSourcesAndContinue() {
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources, startingPath: path, step: 3, status: "in_progress" }),
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

  async function handleAvatar(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1.8 * 1024 * 1024
    ) {
      return toast.error("Use a PNG, JPEG, or WebP image under 1.8 MB.");
    }
    setAvatarUploading(true);
    try {
      setAvatarUrl(await uploadImage(file));
      toast.success("Profile photo added.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Profile photo could not be uploaded.",
      );
    } finally {
      setAvatarUploading(false);
    }
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
      body: JSON.stringify({ status: "complete", startingPath: "clean", step: 5 }),
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
      body: JSON.stringify({ startingPath: nextPath, step: 2, status: "in_progress" }),
    }).catch(() => undefined);
  }

  async function skipSetup() {
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete", startingPath: "skipped", guidanceDismissed: true, step: 5 }),
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
          <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 sm:block">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
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

      <main className="mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-start gap-8 px-4 py-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8 lg:py-12">
        <aside className="hidden lg:block">
          <p className="text-xs font-semibold text-primary">
            Workspace launch
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.035em]">
            Start with momentum, not an empty dashboard.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            rive. turns what you already know—and what you already have—into a
            connected operating system.
          </p>
          <div className="mt-8 space-y-3">
            {[
              "Your business",
              "Your priority",
              "Your fastest path",
              "Workspace ready",
            ].map((label, index) => (
              <div
                key={label}
                className={`flex items-center gap-3 text-xs font-bold ${step >= index ? "text-blue-700 dark:text-blue-300" : "text-slate-400"}`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full border ${step > index ? "border-blue-600 bg-blue-600 text-white" : step === index ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950" : "border-slate-200 dark:border-slate-700"}`}
                >
                  {step > index ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                {label}
              </div>
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {step === 0 && (
            <div className="p-6 sm:p-9">
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                  First, make rive. yours
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  Tell us enough to personalize everything else.
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  This identity will prefill your portfolio, financial defaults,
                  calendar, and future imports.
                </p>
              </div>
              <div className="mt-7 grid gap-5 sm:grid-cols-[140px_minmax(0,1fr)]">
                <div>
                  <div className="mx-auto grid h-28 w-28 min-h-0 min-w-0 place-items-center overflow-hidden rounded-3xl bg-blue-50 text-2xl font-black text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      name.slice(0, 2) || "You"
                    )}
                  </div>
                  <Button
                    type="button"
                    data-testid="onboarding-avatar-upload"
                    aria-controls="onboarding-avatar-input"
                    disabled={avatarUploading}
                    onClick={() => avatarInputRef.current?.click()}
                    className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 disabled:cursor-wait dark:border-blue-800 dark:text-blue-300"
                  >
                    {avatarUploading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        Upload photo
                      </>
                    )}
                  </Button>
                  <Input
                    ref={avatarInputRef}
                    id="onboarding-avatar-input"
                    data-testid="onboarding-avatar-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      void handleAvatar(file);
                    }}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Your name
                    </span>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                      What do you do?
                    </span>
                    <Input
                      value={profession}
                      onChange={(event) => setProfession(event.target.value)}
                      placeholder="Product designer, CA, filmmaker…"
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Default currency
                    </span>
                    <Select
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                      className={inputClass}
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
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Timezone
                    </span>
                    <Input
                      value={timeZone}
                      onChange={(event) => setTimeZone(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>
              <div className="mt-7">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">
                  How do you work? Choose all that apply.
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
                        className={`flex min-h-28 min-w-0 items-start justify-start gap-2 rounded-xl border p-3 text-left whitespace-normal ${businessTypes.includes(item.id) ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-700"}`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-blue-600" />
                        <span className="min-w-0">
                          <p className="text-xs font-black leading-4">{item.label}</p>
                          <p className="mt-1 text-xs leading-4 text-slate-500 dark:text-slate-400">{item.detail}</p>
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
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white disabled:opacity-50"
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

          {step === 1 && (
            <div className="p-6 sm:p-9">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                Choose your first win
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                What should rive. improve first?
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                We will prioritize your setup and dashboard around this—not lock
                you into it.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {GOALS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      aria-pressed={goal === item.id}
                      onClick={() => setGoal(item.id)}
                      className={`flex gap-4 rounded-2xl border p-4 text-left ${item.id === "migrate" ? "sm:col-span-2" : ""} ${goal === item.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-slate-200 hover:border-blue-200 dark:border-slate-700"}`}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-blue-600 shadow-sm dark:bg-slate-800">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-black">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {item.detail}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>
              <div className="mt-7 flex justify-between">
                <Button
                  onClick={() => setStep(0)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={saveGoal}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  Choose my path <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-6 sm:p-9">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                Bring your business with you
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                Start with context, not an empty workspace.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Tell Rive where your work lives today. Select one or more
                existing sources, or choose Mostly starting fresh if you do
                not have records to bring across. Then choose one way to
                populate the workspace.
              </p>
              <div className="mt-7">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
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
                      className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-left text-xs font-bold ${sources.includes(id) ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
                    >
                      <span>{label}</span>
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full border ${sources.includes(id) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 dark:border-slate-600"}`}
                      >
                        {sources.includes(id) && <Check className="h-3 w-3" />}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
              {googleAvailable && (
                <div
                  className={`mt-7 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${googleConnection?.status === "connected" ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20"}`}
                >
                  <div className="flex min-w-0 gap-4">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${googleConnection?.status === "connected" ? "bg-emerald-600 text-white" : "bg-white text-blue-600 shadow-sm dark:bg-slate-900"}`}
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
                        <span className="rounded-full border border-current/15 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                          Live connector
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {googleConnection?.status === "connected"
                          ? `${googleConnection.accountEmail || "Google account"} connected · events and updates sync both ways.`
                            : "Import existing calendars and events now. New Rive events can sync back to Google."}
                      </p>
                    </div>
                  </div>
                  {googleConnection?.status === "connected" ? (
                    <a
                      href="/calendar"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black text-emerald-700 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
                    >
                      Review calendars <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  ) : googleAvailable ? (
                    <a
                      href="/api/calendar/connections/google/start?from=onboarding"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-blue-600/20"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Connect Google
                    </a>
                  ) : null}
                </div>
              )}
              {zohoAvailable && (
                <div
                  className={`mt-4 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${zohoConnection?.status === "connected" ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20"}`}
                >
                  <div className="flex min-w-0 gap-4">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${zohoConnection?.status === "connected" ? "bg-emerald-600 text-white" : "bg-white text-violet-600 shadow-sm dark:bg-slate-900"}`}
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
                        <span className="rounded-full border border-current/15 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
                          {zohoConnection ? "Connected" : "OAuth ready"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {zohoConnection
                          ? `${zohoConnection.accountLabel || "Zoho organization"} is connected. Rive will ask for confirmation before importing financial records.`
                            : "Connect securely to verify your organization. Record import stays disabled until the import review flow is production-ready."}
                      </p>
                    </div>
                  </div>
                  {zohoConnection ? (
                    <span className="inline-flex shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black text-emerald-700 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300">
                      Organization ready
                    </span>
                  ) : zohoAvailable ? (
                    <a
                      href="/api/connectors/zoho-books/start?from=onboarding"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-violet-600/20"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Connect Zoho
                    </a>
                  ) : null}
                </div>
              )}
              <div className="mt-7">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Choose one way to populate operational data
                </p>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  {[
                    {
                      id: "import" as const,
                      icon: FileSpreadsheet,
                      title: "Import my work",
                      detail:
                        "Upload CSV or XLSX exports from Zoho, FreshBooks, QuickBooks, Wave, Xero, or spreadsheets.",
                      badge: "Fastest switch",
                    },
                    {
                      id: "quickstart" as const,
                      icon: Rocket,
                      title: "Build one real workflow",
                      detail:
                        "Create a connected client, project, deadline, and optional draft invoice.",
                      badge: "Best first run",
                    },
                    {
                      id: "clean" as const,
                      icon: Sparkles,
                      title: "Start clean",
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
                        className={`relative flex min-h-40 min-w-0 flex-col items-start justify-start whitespace-normal rounded-2xl border p-5 text-left ${path === item.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-700"}`}
                      >
                        <span className="absolute right-3 top-3 rounded-full bg-white px-2 py-1 text-xs font-black uppercase text-blue-600 shadow-sm dark:bg-slate-800">
                          {item.badge}
                        </span>
                        <Icon className="h-6 w-6 shrink-0 text-blue-600" />
                        <p className="mt-8 text-sm font-black">{item.title}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {item.detail}
                        </p>
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-7 flex justify-between">
                <Button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={() => void saveSourcesAndContinue()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  {path === "clean" ? "Open my workspace" : "Continue"}{" "}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && path === "import" && migrationEngine && (
            <div className="p-6 sm:p-9">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                Migration
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Bring your business into Rive.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Upload the client, project, invoice, and expense exports you
                already have, in any order. Rive works out what each file holds,
                reconnects the records to each other, and shows you exactly what
                it will create before anything is written.
              </p>
              <Button
                className="mt-7 w-full rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white hover:bg-blue-700 sm:w-auto"
                onClick={() => router.push("/migrate")}
              >
                Start importing
              </Button>
              <button
                type="button"
                onClick={() => setPath("quickstart")}
                className="mt-4 block text-xs font-bold text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
              >
                I would rather start with one client instead
              </button>
            </div>
          )}

          {step === 3 && path === "import" && !migrationEngine && (
            <div className="p-6 sm:p-9">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                Migration studio
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Bring your records across with a safety net.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Upload separate client, project, invoice, or expense exports
                together. Rive detects them, previews the result, preserves
                where every record came from, and lets you roll back the
                migration later.
              </p>
              <label className="mt-7 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 px-5 py-10 text-center hover:border-blue-400 dark:border-blue-900 dark:bg-blue-950/20">
                <Upload className="h-8 w-8 text-blue-600" />
                <p className="mt-3 text-sm font-black">
                  Choose up to six CSV or XLSX files
                </p>
                <p className="mt-1 text-xs text-slate-500">
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
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              )}
              {preview.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-[1fr_100px_70px] bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-400 dark:bg-slate-800">
                    <span>File</span>
                    <span>Detected as</span>
                    <span>Rows</span>
                  </div>
                  {preview.map((item) => (
                    <div
                      key={item.name}
                      className="grid grid-cols-[1fr_100px_70px] border-t border-slate-100 px-4 py-3 text-xs dark:border-slate-800"
                    >
                      <span className="truncate font-bold">{item.name}</span>
                      <span
                        className={
                          item.entity === "unknown"
                            ? "font-bold text-red-500"
                            : "font-bold text-blue-600"
                        }
                      >
                        {item.entity}
                      </span>
                      <span>{item.rows}</span>
                      {item.warning && (
                        <span className="col-span-3 mt-1 text-xs text-red-500">
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
                <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">
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
                          className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-xs font-black">
                              {job.files.map((file) => file.name).join(", ") ||
                                job.sourceLabel ||
                                job.source}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {job.createdRecords} created ·{" "}
                              {job.skippedRecords} skipped ·{" "}
                              {job.unresolvedCount} need review
                            </p>
                          </div>
                          <span className="text-xs font-black uppercase text-slate-400">
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
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Choose another path
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={() => runImport("preview")}
                    disabled={saving || !files.length}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
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
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Import workspace
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && path === "quickstart" && (
            <form onSubmit={createQuickstart} className="p-6 sm:p-9">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                One connected workflow
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Start with work you are actually doing.
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                One submission creates the relationship, the work, its calendar
                deadline, and an optional draft invoice.
              </p>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Client name
                  </span>
                  <Input
                    required
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Client email
                  </span>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Project
                  </span>
                  <Input
                    required
                    value={projectTitle}
                    onChange={(event) => setProjectTitle(event.target.value)}
                    placeholder="Website redesign, monthly accounting…"
                    className={inputClass}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                    What are you delivering?
                  </span>
                  <Textarea
                    rows={3}
                    value={projectDescription}
                    onChange={(event) =>
                      setProjectDescription(event.target.value)
                    }
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Deadline
                  </span>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                    draft invoice value ({currency})
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceAmount}
                    onChange={(event) => setInvoiceAmount(event.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="mt-7 flex justify-between">
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Choose another path
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}create
                  my workspace
                </Button>
              </div>
            </form>
          )}

          {step === 4 && (
            <div className="p-7 text-center sm:p-12">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
                Workspace activated
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">
                You are opening rive. with context.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
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
                      className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
                    >
                      <p className="text-2xl font-black">{report[key]}</p>
                      <p className="mt-1 text-xs font-black uppercase tracking-wider text-slate-400">
                        {key}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {report?.unresolvedLinks ? (
                <p className="mt-4 text-xs font-bold text-amber-600">
                  {report.unresolvedLinks} relationships need manual review.
                </p>
              ) : null}
              <Button
                onClick={() => router.replace("/dashboard")}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20"
              >
                Open my operating system <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="mt-5 flex justify-center gap-5 text-xs font-bold text-slate-400">
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
