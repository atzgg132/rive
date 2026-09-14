"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Briefcase,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  DollarSign,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  FolderKanban,
  Globe2,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  ListTodo,
  LogOut,
  Mail,
  Moon,
  MoreVertical,
  PanelLeftClose,
  Plus,
  Receipt,
  Search,
  Settings2,
  Sparkles,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Kicker,
  MetricCard,
  PageHeader,
  StatusBadge,
  Tabs,
} from "@/components/ui";

import AnalyticsCharts from "@/components/dashboard/AnalyticsCharts";
import { RiveLogo } from "@/components/RiveLogo";
import type { FinancialChartInput } from "@/utils/financialChart";
import type { BadgeVariant } from "@/components/ui/badge";

export type WorkspacePreviewView = "dashboard" | "clients" | "projects" | "agreements" | "revenue" | "calendar" | "portfolio";

type ViewProps = { compact?: boolean };

/* ------------------------------------------------------------------ */
/* Seeded workspace data — one fictional studio (Maya Rao), reshaped   */
/* to match the payloads the real pages render. Numbers stay consistent */
/* with the record journey: INV-024 · Aster House is out for payment.  */
/* ------------------------------------------------------------------ */

export const seededClients = [
  { name: "Aster House", company: "asterhouse.co", email: "hello@asterhouse.co", color: "#2354d3", status: "active", tags: ["Retainer"], stats: "2 projects · ₹1,80,000 invoiced", paid: "₹1,80,000", owes: "₹90,000" },
  { name: "Northline Studio", company: "northline.studio", email: "team@northline.studio", color: "#0f9a72", status: "active", tags: [], stats: "1 project · ₹96,000 invoiced", paid: "₹96,000" },
  { name: "Field Notes", company: "fieldnotes.co", email: "brief@fieldnotes.co", color: "#7c4dcc", status: "active", tags: ["Referral"], stats: "1 project · ₹72,000 invoiced", paid: "₹72,000" },
  { name: "Meridian Labs", company: "meridianlabs.io", email: "ops@meridianlabs.io", color: "#c2570b", status: "active", tags: [], stats: "1 project · ₹36,500 invoiced", paid: "₹36,500", owes: "₹36,500" },
  { name: "Solace Health", company: "solacehealth.in", email: "care@solacehealth.in", color: "#be4a8a", status: "active", tags: [], stats: "1 project · ₹58,000 invoiced", paid: "₹58,000" },
  { name: "Kaveri Foods", company: "kaverifoods.in", email: "hello@kaverifoods.in", color: "#64748b", status: "inactive", tags: [], stats: "1 project · ₹24,000 invoiced", paid: "₹24,000" },
] as const;

const dashboardSignals = [
  { tag: "Invoice", tone: "info", title: "INV-024 opened by Aster House", detail: "Sent Aug 21 · due Aug 28", at: "Aug 21, 10:24" },
  { tag: "Payment", tone: "success", title: "₹48,000 recorded from Northline Studio", detail: "INV-019 · Brand system", at: "Aug 14, 16:02" },
  { tag: "Agreement", tone: "violet", title: "Research engagement accepted", detail: "Field Notes · recorded Aug 12", at: "Aug 12, 11:40" },
  { tag: "Enquiry", tone: "warning", title: "New enquiry via portfolio", detail: "Product audit · came through rive.site", at: "Aug 11, 09:15" },
  { tag: "Client", tone: "info", title: "Meridian Labs added to the record", detail: "1 active project", at: "Aug 09, 14:31" },
] satisfies { tag: string; tone: BadgeVariant; title: string; detail: string; at: string }[];

const dashboardInsights: {
  label: string;
  value: string;
  sub: string;
  Icon?: LucideIcon;
  tone?: "success" | "warning" | "primary";
  big?: boolean;
}[] = [
  { label: "Collection rate", value: "69%", sub: "All-time share of invoiced value collected" },
  { label: "Profit margin", value: "82%", sub: "All time, after logged expenses", tone: "success" },
  { label: "Overdue", value: "₹36,500", sub: "2 invoices need attention", Icon: AlertTriangle, tone: "warning" },
  { label: "Next 14 days", value: "Meridian brand system", sub: "3 upcoming projects", Icon: CalendarDays, tone: "primary", big: true },
];

const dashboardChart: FinancialChartInput[] = [
  { month: "2026-03", revenue: 98000, expenses: 9400 },
  { month: "2026-04", revenue: 124000, expenses: 12600 },
  { month: "2026-05", revenue: 86000, expenses: 7800 },
  { month: "2026-06", revenue: 142000, expenses: 15200 },
  { month: "2026-07", revenue: 118500, expenses: 9800 },
  { month: "2026-08", revenue: 96500, expenses: 7400 },
];

const revenueSummary = [
  { label: "Total invoiced", value: "₹4,11,000", Icon: FileText },
  { label: "Collected", value: "₹2,84,500", Icon: WalletCards },
  { label: "Outstanding", value: "₹90,000", Icon: Clock3 },
  { label: "Overdue", value: "₹36,500", Icon: AlertTriangle },
  { label: "Draft pipeline", value: "₹72,000", Icon: FileText },
] as const;

const invoiceRows = [
  { number: "INV-024", issued: "Issued Aug 21", client: "Aster House", project: "Website launch", due: "Aug 28", amount: "₹90,000", status: "sent" },
  { number: "INV-021", issued: "Issued Jul 22", client: "Meridian Labs", project: "Q3 design retainer", due: "Aug 05", amount: "₹36,500", status: "overdue" },
  { number: "INV-019", issued: "Issued Aug 02", client: "Northline Studio", project: "Brand system", due: "Paid Aug 14", amount: "₹48,000", status: "paid" },
  { number: "INV-017", issued: "Issued Aug 10", client: "Field Notes", project: "Research sprint", due: "No due date", amount: "₹72,000", status: "draft" },
] as const;

const projectRows = [
  { title: "Website launch", client: "Aster House", note: "Marketing site redesign & CMS handoff", priority: "high", status: "active", rail: "bg-info", due: "Due Thursday", dueTone: "text-warning", pct: "66%", milestones: "4/6 milestones", budget: "₹90,000", contract: "Rive contract · in review", contractTone: "text-warning" },
  { title: "Brand system", client: "Northline Studio", note: "Identity, guidelines & asset kit", priority: "medium", status: "active", rail: "bg-info", due: "Milestone Friday", dueTone: "text-warning", pct: "40%", milestones: "2/5 milestones", budget: "₹96,000", contract: "Rive contract · accepted", contractTone: "text-success" },
  { title: "Research sprint", client: "Field Notes", note: "Discovery interviews & synthesis", priority: "low", status: "active", rail: "bg-info", due: "Due Sep 04", dueTone: "text-muted-foreground", pct: "75%", milestones: "3/4 milestones", budget: "₹72,000", contract: "Contract undecided", contractTone: "text-warning" },
  { title: "Q3 design retainer", client: "Meridian Labs", note: "Ongoing product design support", priority: "medium", status: "paused", rail: "bg-warning", due: "No deadline", dueTone: "text-muted-foreground", pct: null, milestones: "No milestones", budget: "₹36,500", contract: "Review draft", contractTone: "text-muted-foreground" },
] as const;

const agreementSummary = [
  { label: "Needs your action", value: "1" },
  { label: "With clients", value: "1" },
  { label: "Acceptance", value: "1" },
  { label: "Accepted", value: "2" },
] as const;

const agreementCards = [
  { title: "Website launch agreement", client: "Aster House", project: "Website launch", status: "in_review", action: "Open the review workspace", hint: "Waiting for comments", metrics: "0/2 accepted · v3 Aug 20 · ₹90,000 · 2 triggers" },
  { title: "Brand system terms", client: "Northline Studio", project: "Brand system", status: "signing", action: "Waiting for client", hint: "1 of 2 accepted", metrics: "1/2 accepted · v1 Aug 09 · ₹96,000 · 1 trigger" },
  { title: "Research engagement", client: "Field Notes", project: "Research sprint", status: "executed", action: "View agreement & invoices", hint: "Accepted Aug 12", metrics: "2/2 accepted · v2 Aug 12 · ₹72,000 · manual billing" },
] as const;

export const calendarWeek = [
  { name: "Mon", num: "10", today: false, events: [{ time: "10:00", title: "Homepage review · Aster", tone: "work" }, { time: "15:30", title: "Invoice follow-up", tone: "work" }] },
  { name: "Tue", num: "11", today: true, events: [{ time: "09:30", title: "Focus · Brand concepts", tone: "work" }] },
  { name: "Wed", num: "12", today: false, events: [{ time: "All day", title: "INV-024 due · ₹90,000", tone: "money" }, { time: "14:00", title: "Client call · Field Notes", tone: "work" }] },
  { name: "Thu", num: "13", today: false, events: [{ time: "11:00", title: "Milestone delivery · Northline", tone: "milestone" }] },
  { name: "Fri", num: "14", today: false, events: [{ time: "All day", title: "Brand system · milestone", tone: "money" }] },
  { name: "Sat", num: "15", today: false, events: [] },
  { name: "Sun", num: "16", today: false, events: [] },
] as const;

const eventTone: Record<string, string> = {
  work: "border-info bg-info/10 text-info",
  money: "border-warning bg-warning/10 text-warning",
  milestone: "border-violet bg-violet/10 text-violet",
};

const studioSections = [
  { label: "Selected work", sub: "3 projects", Icon: FolderKanban, active: true },
  { label: "Profile", sub: "Identity & contact", Icon: Settings2, active: false },
  { label: "Services", sub: "2 services", Icon: Briefcase, active: false },
  { label: "Testimonials", sub: "2 added", Icon: Sparkles, active: false },
  { label: "Appearance", sub: "Theme & visibility", Icon: Eye, active: false },
] as const;

const studioWork = [
  { title: "Website launch", meta: "Aster House · Product design", visibility: "Public", tone: "success" as BadgeVariant },
  { title: "Brand system", meta: "Northline Studio · Brand identity", visibility: "Public", tone: "success" as BadgeVariant },
  { title: "Research sprint", meta: "Field Notes · UX research", visibility: "Private", tone: "muted" as BadgeVariant },
] as const;

export function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Shell — the real workspace chrome, simplified: sidebar nav + ⌘K     */
/* topbar, institution-recolored by the marketing token map.           */
/* ------------------------------------------------------------------ */

const NAV: readonly { id: WorkspacePreviewView | "expenses"; label: string; Icon: LucideIcon }[] = [
  { id: "dashboard", label: "Overview", Icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "projects", label: "Projects", Icon: Briefcase },
  { id: "agreements", label: "Agreements", Icon: FileSignature },
  { id: "clients", label: "Clients", Icon: Users },
  { id: "revenue", label: "Revenue & invoices", Icon: DollarSign },
  { id: "expenses", label: "Expenses", Icon: Receipt },
  { id: "portfolio", label: "Portfolio", Icon: Globe2 },
];

function NavItem({ active, label, Icon }: { active: boolean; label: string; Icon: LucideIcon }) {
  return (
    <span
      className={
        active
          ? "relative flex min-h-11 items-center gap-3 bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground before:absolute before:bottom-[30%] before:left-0 before:top-[30%] before:w-[2px] before:bg-accent-foreground"
          : "flex min-h-11 items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground"
      }
    >
      <Icon strokeWidth={1.75} className="h-5 w-5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function WorkspaceShell({ view, children }: { view: WorkspacePreviewView; children: ReactNode }) {
  return (
    <div className="flex h-full bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <RiveLogo height={26} />
          <div className="min-w-0 flex-1" />
          <PanelLeftClose className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <nav className="min-h-0 flex-1 space-y-1 px-3 py-5" aria-hidden="true">
          {NAV.map((item) => (
            <NavItem key={item.id} active={item.id === view} label={item.label} Icon={item.Icon} />
          ))}
        </nav>
        <div className="shrink-0 border-t border-border px-1 py-4">
          <div className="px-3 py-2">
            <div className="flex items-center gap-3">
              <Avatar size="md" aria-hidden="true"><span>MR</span></Avatar>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">Maya Rao</span>
                <span className="block truncate text-xs text-muted-foreground">maya@mayarao.design</span>
              </div>
            </div>
            <Badge variant="outline" className="ml-12 mt-2 capitalize">Free</Badge>
          </div>
          <span className="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm font-medium text-destructive">
            <LogOut className="h-5 w-5" />
            Sign out
          </span>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <Button variant="outline" size="sm" className="w-72 justify-between text-muted-foreground hover:translate-y-0 hover:border-border hover:bg-card hover:text-foreground">
            <span className="flex items-center gap-2 overflow-hidden">
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate whitespace-nowrap">Search workspace...</span>
            </span>
            <span className="flex items-center gap-1 rounded-none border border-border bg-muted px-1.5 py-0.5 font-mono text-[.7rem]">
              <Command className="h-2.5 w-2.5" /> K
            </span>
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="inverse" className="gap-2 whitespace-nowrap"><Plus className="h-4 w-4" />New client work</Button>
            <span className="flex items-center gap-1.5 rounded-none border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">INR · Indian rupee<ChevronDown className="h-3.5 w-3.5" /></span>
            <Moon className="h-5 w-5 text-muted-foreground" />
            <CircleHelp className="h-5 w-5 text-muted-foreground" />
            <span className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="h-7 w-px bg-border" />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden p-6">{children}</main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Views — each mirrors its real page's structure on the same          */
/* primitives. Keep page order: what identifies the page sits in-frame. */
/* ------------------------------------------------------------------ */

function DashboardView({ compact }: ViewProps) {
  return (
    <>
      <PageHeader
        titleAs="div"
        title="Overview"
        description="Cash in, costs out, and the signals worth acting on."
        actions={
          <>
            <div role="group" aria-label="Dashboard totals period" className="flex gap-1 rounded-none border border-border bg-card p-1">
              {["This month", "6 months", "All time"].map((label, index) => (
                <span key={label} className={`rounded-none px-3 py-1.5 text-xs font-bold ${index === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{label}</span>
              ))}
            </div>
            <Button variant="secondary"><Plus className="h-3.5 w-3.5" />New project</Button>
            <Button variant="default"><FileText className="h-3.5 w-3.5" />New invoice</Button>
          </>
        }
      />
      <div className="mt-7 grid grid-cols-2 items-stretch gap-6 xl:grid-cols-4">
        <MetricCard label="Cash collected" value="₹2,84,500" sub="+12.4% vs last month to day 21 · ₹1,26,500 still owed" />
        <MetricCard label="Active projects" value="4" sub="Right now — unaffected by the period" />
        <MetricCard label="Expenses" value="₹38,240" sub="All-time logged" />
        <MetricCard label="Net" value="₹2,46,260" sub="Cash received minus expenses" />
      </div>
      <section className={`mt-6 grid items-stretch gap-6 ${compact ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-4"}`}>
        {(compact ? dashboardInsights.slice(0, 2) : dashboardInsights).map((insight) => (
          <Card key={insight.label} className="flex h-full min-h-28 flex-col rounded-none border-border bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              {insight.Icon ? <insight.Icon className={`h-3.5 w-3.5 ${insight.tone === "warning" ? "text-warning" : "text-primary"}`} /> : null}
              {insight.label}
            </p>
            <div className="mt-auto min-w-0 pt-2">
              <p className={`font-mono text-xl font-black tabular-nums ${insight.big ? "truncate text-sm font-black" : ""} ${insight.tone === "success" ? "text-success" : "text-foreground"}`}>{insight.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{insight.sub}</p>
            </div>
          </Card>
        ))}
      </section>
      {!compact && (
        <>
          <div className="mt-6"><AnalyticsCharts data={[...dashboardChart]} currency="INR" /></div>
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="flex flex-col gap-5 rounded-none border border-border bg-card p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Signals</h3>
                <Badge>Updates automatically</Badge>
              </div>
              <p className="-mt-3 text-xs text-muted-foreground">What happened while you were away — an invoice opened, a payment landed, an enquiry arrived.</p>
              <div className="flex flex-col gap-4">
                {dashboardSignals.map((signal) => (
                  <div key={signal.title} className="flex items-center justify-between gap-3 rounded-none border border-border bg-card p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Badge variant={signal.tone} className="uppercase">{signal.tag}</Badge>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{signal.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{signal.detail}</span>
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{signal.at}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-none border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Top clients</h3>
                <span className="flex items-center text-xs font-bold text-primary">View all<ChevronRight className="h-3 w-3" /></span>
              </div>
              <div className="flex flex-col gap-3">
                {seededClients.slice(0, 4).map((client) => (
                  <div key={client.name} className="flex items-center justify-between rounded-none border border-border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold uppercase text-primary-foreground" style={{ backgroundColor: client.color }}>{initials(client.name)}</span>
                      <span className="flex flex-col">
                        <span className="text-xs font-bold">{client.name}</span>
                        <span className="text-xs text-muted-foreground">{client.company}</span>
                      </span>
                    </div>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-xs font-extrabold tabular-nums text-success">{client.paid}</span>
                      {"owes" in client && client.owes ? <span className="mt-0.5 block font-mono text-[0.6875rem] tabular-nums text-warning">owes {client.owes}</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {compact && (
        <div className="mt-4 flex flex-col gap-3">
          {dashboardSignals.slice(0, 3).map((signal) => (
            <div key={signal.title} className="flex items-center gap-3 rounded-none border border-border bg-card p-3">
              <Badge variant={signal.tone} className="uppercase">{signal.tag}</Badge>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{signal.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{signal.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ClientsView({ compact }: ViewProps) {
  const clients = compact ? seededClients.slice(0, 3) : seededClients;
  return (
    <>
      <PageHeader
        titleAs="div"
        title="Clients"
        description="Keep contact details, projects, invoices, and relationship history together."
        actions={<Button variant="default"><Plus className="h-4 w-4" />Add client</Button>}
      />
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input readOnly value="" placeholder="Search by name, email, company..." className="pl-9" aria-label="Search clients" />
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-none border border-border bg-card px-3 py-2 text-xs font-semibold"><span className="text-muted-foreground">Status</span>All clients<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></span>
      </div>
      <div className={`mt-5 grid grid-cols-1 gap-4 ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {clients.map((client) => (
          <div key={client.name} className="relative flex flex-col justify-between rounded-none border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-4 pr-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold uppercase text-primary-foreground" style={{ backgroundColor: client.color }}>{initials(client.name)}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-bold">{client.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{client.company}</span>
                </span>
              </div>
              <StatusBadge kind="client" value={client.status} className="uppercase" />
            </div>
            <div className="mb-4 flex flex-col gap-2 border-t border-border pt-4">
              <span className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5" /><span className="truncate">{client.email}</span></span>
            </div>
            <div className="mt-auto border-t border-border pt-3 text-xs text-muted-foreground">{client.stats}</div>
            <MoreVertical className="absolute right-4 top-4 h-4 w-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    </>
  );
}

function ProjectsView({ compact }: ViewProps) {
  const groups = compact ? [{ label: "This week", projects: projectRows.slice(0, 2) }] : [
    { label: "This week", projects: projectRows.slice(0, 2) },
    { label: "Later", projects: projectRows.slice(2) },
  ];
  return (
    <>
      <PageHeader
        titleAs="div"
        title="Projects"
        description="Keep delivery moving with clear milestones, budgets, tasks, and deadlines."
        actions={
          <>
            <Button variant="secondary"><Plus className="h-4 w-4" />New client work</Button>
            <Button variant="default"><Plus className="h-4 w-4" />Create project</Button>
          </>
        }
      />
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input readOnly value="" placeholder="Search by title, description..." className="pl-9" aria-label="Search projects" />
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-none border border-border bg-card px-3 py-2 text-xs font-semibold"><span className="text-muted-foreground">Sort</span>Deadline first<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Tabs
          value="all"
          onChange={() => undefined}
          options={[
            { id: "all", label: "All work", count: 6 },
            { id: "active", label: "In progress", count: 3 },
            { id: "paused", label: "Paused", count: 1 },
            { id: "completed", label: "Completed", count: 2 },
          ]}
        />
      </div>
      {groups.map((group) => (
        <section key={group.label}>
          <p className="mt-5 text-xs font-black uppercase tracking-wider text-muted-foreground">{group.label}</p>
          <div className="mt-2 flex flex-col gap-3">
            {group.projects.map((project) => (
              <article key={project.title} className="group relative rounded-none border border-border bg-card py-3 pl-5 pr-4">
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${project.rail}`} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{project.title}</h3>
                      <StatusBadge kind="priority" value={project.priority} className="shrink-0" />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{project.client} · {project.note}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 font-semibold"><StatusBadge kind="project" value={project.status} /><ChevronDown className="h-3.5 w-3.5 opacity-60" /></span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3 text-xs">
                  <span className={`font-bold ${project.dueTone}`}>{project.due}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {project.pct ? <span className="block h-1 w-16 overflow-hidden rounded-none bg-muted"><span className="block h-full bg-info" style={{ width: project.pct }} /></span> : null}
                    {project.milestones}
                  </span>
                  <span className="font-mono font-bold tabular-nums text-success">{project.budget}</span>
                  <span className={`flex items-center gap-1.5 font-semibold ${project.contractTone}`}><FileSignature className="h-3.5 w-3.5" />{project.contract}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function AgreementsView({ compact }: ViewProps) {
  const cards = compact ? agreementCards.slice(0, 2) : agreementCards;
  return (
    <>
      <PageHeader
        titleAs="div"
        title="Agreements"
        description="Draft, review, accept, and bill from one agreement using the client and project details already in Rive."
        actions={<Button variant="default"><Plus className="h-4 w-4" />New Agreement</Button>}
      />
      <div className={`mt-5 grid gap-3 ${compact ? "grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
        {(compact ? agreementSummary.slice(0, 2) : agreementSummary).map((item) => (
          <div key={item.label} className="rounded-none border border-border bg-card p-4">
            <Kicker tone="muted" dot={false}>{item.label}</Kicker>
            <p className="mt-3 font-mono text-2xl font-bold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      {!compact && (
        <Card className="mt-4 border-primary/20 bg-primary/[0.035]">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-bold">1 active project needs an Agreement decision</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Start with the existing client, brief, milestones, and currency.</p>
              </div>
            </div>
            <Button variant="outline" className="shrink-0">Review projects</Button>
          </CardContent>
        </Card>
      )}
      <div className={`mt-4 grid gap-4 ${compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {cards.map((contract) => (
          <Card key={contract.title} className="h-full">
            <CardContent className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-extrabold">{contract.title}</h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{contract.client} · {contract.project}</p>
                </div>
                <StatusBadge kind="contract" value={contract.status} />
              </div>
              <div className="rounded-none bg-muted/[0.45] px-3 py-2.5">
                <p className="text-xs font-bold">{contract.action}</p>
                <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{contract.hint}</p>
              </div>
              <p className="mt-auto border-t border-border pt-4 text-xs text-muted-foreground">{contract.metrics}</p>
              <span className="inline-flex items-center justify-end gap-1 text-xs font-bold text-primary">Open Agreement<ArrowRight className="h-3.5 w-3.5" /></span>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function RevenueView({ compact }: ViewProps) {
  const summary = compact ? revenueSummary.slice(0, 3) : revenueSummary;
  const rows = compact ? invoiceRows.slice(0, 3) : invoiceRows;
  return (
    <>
      <PageHeader
        titleAs="div"
        title="Revenue & invoices"
        description="A reliable view of what has been invoiced, collected, and needs attention across every currency."
        actions={<Button variant="default"><Plus className="h-4 w-4" />Create invoice</Button>}
      />
      <div className={`mt-5 grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-5"}`}>
        {summary.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-none border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <Kicker tone="muted" dot={false}>{label}</Kicker>
              <span className="grid h-8 w-8 place-items-center rounded-none bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
            </div>
            <p className="mt-4 font-mono text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          </div>
        ))}
      </div>
      {!compact && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-none border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Kicker>Collection health</Kicker>
                <h3 className="mt-1 text-xl font-semibold">69% collected</h3>
                <p className="mt-1 text-sm text-muted-foreground">Collected against issued invoice value.</p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Invoice settings<ArrowRight className="h-3.5 w-3.5" /></span>
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-none bg-muted"><div className="h-full bg-success" style={{ width: "69%" }} /></div>
            <div className="mt-5 rounded-none border border-border/70 bg-background p-3">
              <div className="flex justify-between text-xs text-muted-foreground"><span>INR</span><span>4 invoices</span></div>
              <p className="mt-2 font-mono text-sm font-semibold tabular-nums">₹2,84,500</p>
              <p className="mt-1 text-xs text-muted-foreground">69% collection rate</p>
            </div>
          </section>
          <section className="rounded-none border border-border bg-card p-5">
            <Kicker>A/R aging</Kicker>
            <h3 className="mt-1 text-xl font-semibold">Where outstanding money sits</h3>
            <div className="mt-5 rounded-none border border-border/70 p-3">
              <div className="flex justify-between text-xs font-semibold"><span>INR</span><span>₹36,500 overdue</span></div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-none bg-muted" aria-hidden="true">
                <span className="bg-warning/50" style={{ width: "38%" }} />
                <span className="bg-warning" style={{ width: "24%" }} />
                <span className="bg-destructive/60" style={{ width: "22%" }} />
                <span className="bg-destructive" style={{ width: "16%" }} />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 whitespace-nowrap text-xs text-muted-foreground">
                <span>1–30<br /><strong className="font-mono tabular-nums text-foreground">14,000</strong></span>
                <span>31–60<br /><strong className="font-mono tabular-nums text-foreground">8,700</strong></span>
                <span>61–90<br /><strong className="font-mono tabular-nums text-foreground">8,000</strong></span>
                <span>90+<br /><strong className="font-mono tabular-nums text-foreground">5,800</strong></span>
              </div>
            </div>
          </section>
        </div>
      )}
      <section className="mt-5 rounded-none border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <Kicker>Invoice workspace</Kicker>
            <h3 className="mt-1 text-xl font-semibold">All invoices</h3>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input readOnly value="" placeholder="Search invoices, clients…" className="w-56 pl-9" aria-label="Search invoices" />
            </div>
            <span className="flex items-center gap-2 rounded-none border border-border bg-card px-3 py-2 text-xs font-semibold"><span className="text-muted-foreground">Status</span>All<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></span>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Invoice</th>
              {!compact && <th className="px-5 py-3">Client / project</th>}
              {!compact && <th className="px-5 py-3">Due</th>}
              <th className="px-5 py-3 text-right">Amount due</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((invoice) => (
              <tr key={invoice.number}>
                <td className="px-5 py-4">
                  <span className="font-mono font-semibold tabular-nums">{invoice.number}</span>
                  <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{invoice.issued}</p>
                </td>
                {!compact && (
                  <td className="px-5 py-4">
                    <p className="font-medium">{invoice.client}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{invoice.project}</p>
                  </td>
                )}
                {!compact && <td className="px-5 py-4 font-mono tabular-nums text-muted-foreground">{invoice.due}</td>}
                <td className="px-5 py-4 text-right font-mono font-semibold tabular-nums">{invoice.amount}</td>
                <td className="px-5 py-4"><StatusBadge kind="invoice" value={invoice.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function CalendarView({ compact }: ViewProps) {
  const days = compact ? calendarWeek.slice(0, 5) : calendarWeek;
  return (
    <>
      <PageHeader
        titleAs="div"
        title="Your work, on one timeline"
        description="Plan meetings and focus time alongside project deadlines, tasks, milestones, and invoice due dates."
        actions={
          <>
            <Button variant="outline"><span className="h-2 w-2 rounded-full bg-success" /><ExternalLink className="h-4 w-4" />2 synced</Button>
            {!compact && <Button variant="outline"><ListTodo className="h-4 w-4" />Add task</Button>}
            <Button variant="default"><Plus className="h-4 w-4" />New event</Button>
          </>
        }
      />
      <div className="mb-4 mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous date range"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next date range"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="ml-1">Today</Button>
          <span className="ml-1 inline-flex items-center gap-1 rounded-none border border-border bg-card px-2 py-1.5 text-xs font-bold">
            <CalendarRange className="h-3.5 w-3.5 text-primary" />August&nbsp;<span className="font-mono tabular-nums">2026</span>
          </span>
          <h3 className="ml-2 text-sm font-black">10–16 August</h3>
        </div>
        <Tabs
          value="week"
          onChange={() => undefined}
          options={[{ id: "month", label: "month" }, { id: "week", label: "week" }, { id: "agenda", label: "agenda" }]}
        />
      </div>
      <div className={`grid divide-x divide-border overflow-hidden rounded-none border border-border bg-card ${compact ? "grid-cols-5" : "grid-cols-7"}`}>
        {days.map((day) => (
          <div key={day.num} className={`min-w-0 p-2 ${compact ? "min-h-[10rem]" : "min-h-[15rem]"}`}>
            <div className={`mb-2 flex flex-col items-center gap-1 ${day.today ? "text-primary" : "text-muted-foreground"}`}>
              <span className="text-[0.625rem] font-extrabold uppercase tracking-wider">{day.name}</span>
              <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${day.today ? "bg-primary text-primary-foreground" : ""}`}>{day.num}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {day.events.map((event) => (
                <span key={event.title} className={`block rounded-none border border-l-2 px-1.5 py-1 text-[0.6875rem] font-semibold leading-4 ${eventTone[event.tone]}`}>
                  <span className="block text-[0.5625rem] font-extrabold opacity-75">{event.time}</span>
                  {event.title}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!compact && (
        <section className="mt-4 rounded-none border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black">Planning queue</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Turn unfinished tasks into protected focus blocks.</p>
            </div>
            <Button variant="outline" size="sm" className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" />Add task</Button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {[{ title: "Prepare Meridian proposal", meta: "45 min" }, { title: "Send invoice reminder", meta: "15 min" }].map((task) => (
              <div key={task.title} className="flex items-center gap-3 rounded-none border border-border p-3">
                <span className="h-4 w-4 shrink-0 rounded-full border border-border" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{task.title}</p>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{task.meta}</p>
                </div>
                <span className="rounded-none bg-info/10 px-2 py-1.5 text-xs font-bold text-info">Schedule</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function PortfolioView({ compact }: ViewProps) {
  return (
    <>
      <PageHeader
        titleAs="div"
        title="Portfolio Studio"
        description="Build a portfolio that makes your work easy to understand and easy to hire."
        actions={<Button variant="outline"><ExternalLink className="h-4 w-4" />View live site</Button>}
      />
      <div className="mt-5 flex min-h-12 flex-wrap items-center justify-end gap-2 border-y border-border px-1 py-2">
        <span className="mr-auto text-xs font-semibold text-muted-foreground">All changes saved</span>
        <Button variant="outline" size="sm"><Eye className="h-3.5 w-3.5" />Preview</Button>
        <Button variant="default" size="sm"><Check className="h-3.5 w-3.5" />Update live site</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-1">
          {[
            { label: "Editor", Icon: LayoutTemplate, active: true },
            { label: "Analytics", Icon: BarChart3, active: false },
            { label: "Enquiries", Icon: Inbox, active: false, count: 2 },
          ].map((tab) => (
            <span key={tab.label} className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold ${tab.active ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              <tab.Icon className="h-4 w-4" />{tab.label}
              {tab.count ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-black tabular-nums text-primary-foreground">{tab.count}</span> : null}
            </span>
          ))}
        </div>
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-success" /><b className="font-bold text-success">Published</b>· rive.site/p/maya-rao</span>
      </div>
      <div className={`mt-4 grid min-h-0 gap-0 overflow-hidden rounded-none border border-border bg-card ${compact ? "" : "lg:grid-cols-[210px_minmax(0,1fr)]"}`}>
        {!compact && (
          <aside className="border-r border-border bg-muted/35 p-4">
            <nav className="flex flex-col gap-1">
              {studioSections.map((section) => (
                <span key={section.label} className={`flex items-center gap-3 rounded-none px-3 py-2.5 ${section.active ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>
                  <section.Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{section.label}</span><span className="block truncate text-xs text-muted-foreground">{section.sub}</span></span>
                </span>
              ))}
            </nav>
          </aside>
        )}
        <div className="min-w-0 p-5">
          <Kicker>Selected work</Kicker>
          <h3 className="mt-1 text-lg font-extrabold tracking-tight">Choose the work that represents you.</h3>
          <div className="mt-4 flex flex-col gap-2.5">
            {studioWork.map((work) => (
              <div key={work.title} className="flex items-center gap-3 rounded-none border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{work.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{work.meta}</p>
                </div>
                <Badge variant={work.tone}>{work.visibility}</Badge>
              </div>
            ))}
          </div>
          <span className="mt-3 flex items-center justify-center gap-2 rounded-none border border-dashed border-border px-4 py-3 text-xs font-bold text-muted-foreground"><Plus className="h-3.5 w-3.5" />Add project</span>
        </div>
      </div>
    </>
  );
}

const views: Record<WorkspacePreviewView, ComponentType<ViewProps>> = {
  dashboard: DashboardView,
  clients: ClientsView,
  projects: ProjectsView,
  agreements: AgreementsView,
  revenue: RevenueView,
  calendar: CalendarView,
  portfolio: PortfolioView,
};

/** A single workspace view without chrome — the compact shell renders this. */
export function WorkspaceView({ view, compact = false }: { view: WorkspacePreviewView; compact?: boolean }) {
  const ViewContent = views[view];
  return <ViewContent compact={compact} />;
}

/** The workspace as a plate. Renders the real app shell and the real page
 * structure on the app's own primitives — the marketing token map repaints
 * it onto the institution palette. Inert: it is a reproduction, not a demo. */
export function WorkspacePreview({ view, className = "" }: { view: WorkspacePreviewView; className?: string }) {
  return (
    <div className={`workspace-preview h-full overflow-hidden ${className}`} data-workspace-preview={view} role="img" aria-label="Rive product preview">
      <WorkspaceShell view={view}>
        <WorkspaceView view={view} />
      </WorkspaceShell>
    </div>
  );
}
