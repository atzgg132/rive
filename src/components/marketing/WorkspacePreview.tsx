import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Eye,
  FileCheck2,
  FileSignature,
  FileText,
  FolderKanban,
  Grid2X2,
  Inbox,
  Link2,
  Mail,
  MessageSquareText,
  Moon,
  Plus,
  Receipt,
  Search,
  Settings2,
  Sparkles,
  TrendingUp,
  UserRound,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { RiveLogo } from "@/components/RiveLogo";

export type WorkspacePreviewView = "dashboard" | "clients" | "projects" | "agreements" | "revenue" | "calendar" | "portfolio";

export const navigation = [
  ["dashboard", "Overview", Grid2X2],
  ["calendar", "Calendar", CalendarDays],
  ["projects", "Projects", BriefcaseBusiness],
  ["agreements", "Agreements", FileSignature],
  ["clients", "Clients", UsersRound],
  ["revenue", "Revenue & invoices", CircleDollarSign],
  ["portfolio", "Portfolio", FolderKanban],
] as const;

export const pageCopy: Record<WorkspacePreviewView, { title: string; description: string; action: string; ActionIcon: LucideIcon; secondary?: string; SecondaryIcon?: LucideIcon }> = {
  dashboard: { title: "Overview", description: "Cash in, costs out, and the signals worth acting on.", action: "New invoice", ActionIcon: FileText, secondary: "New project", SecondaryIcon: Plus },
  clients: { title: "Clients", description: "Keep contact details, projects, invoices, and relationship history together.", action: "Add client", ActionIcon: Plus },
  projects: { title: "Projects", description: "Keep delivery moving with clear milestones, budgets, tasks, and deadlines.", action: "Create project", ActionIcon: Plus },
  agreements: { title: "Agreements", description: "Draft, review, accept, and bill from one agreement using the client and project details already in Rive.", action: "New agreement", ActionIcon: Plus },
  revenue: { title: "Revenue & invoices", description: "A reliable view of what has been invoiced, collected, and needs attention across every currency.", action: "Create invoice", ActionIcon: Plus },
  calendar: { title: "Your work, on one timeline", description: "Plan meetings and focus time alongside project deadlines, tasks, milestones, and invoice due dates.", action: "New event", ActionIcon: Plus, secondary: "Calendar feeds", SecondaryIcon: Link2 },
  portfolio: { title: "Portfolio Studio", description: "Build a portfolio that makes your work easy to understand and easy to hire.", action: "Update live site", ActionIcon: Check, secondary: "Preview", SecondaryIcon: Eye },
};

export function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Seeded workspace data — one fictional studio, reused across views.  */
/* ------------------------------------------------------------------ */

export const seededClients = [
  { name: "Aster House", company: "asterhouse.co", email: "hello@asterhouse.co", color: "#2354d3", status: "Active", projects: "2 projects", paid: "₹1,80,000" },
  { name: "Northline Studio", company: "northline.studio", email: "team@northline.studio", color: "#0f9a72", status: "Active", projects: "1 project", paid: "₹96,000" },
  { name: "Field Notes", company: "fieldnotes.co", email: "brief@fieldnotes.co", color: "#7c4dcc", status: "Active", projects: "1 project", paid: "₹72,000" },
  { name: "Meridian Labs", company: "meridianlabs.io", email: "ops@meridianlabs.io", color: "#c2570b", status: "Active", projects: "1 project", paid: "₹36,500" },
  { name: "Solace Health", company: "solacehealth.in", email: "care@solacehealth.in", color: "#be4a8a", status: "Active", projects: "1 project", paid: "₹58,000" },
  { name: "Kaveri Foods", company: "kaverifoods.in", email: "hello@kaverifoods.in", color: "#64748b", status: "Inactive", projects: "1 project", paid: "₹24,000" },
] as const;

export const dashboardMetrics = [
  { label: "Revenue collected", value: "₹2,84,500", sub: "Outstanding: ₹1,26,500", Icon: CircleDollarSign, tone: "green" },
  { label: "Active projects", value: "4", sub: "Currently in progress", Icon: Briefcase, tone: "blue" },
  { label: "Expenses logged", value: "₹38,240", sub: "All categorized business costs", Icon: Receipt, tone: "red" },
  { label: "Net earnings", value: "₹2,46,260", sub: "Collected minus expenses", Icon: TrendingUp, tone: "violet" },
] as const;

export const dashboardActivity = [
  { kind: "Invoice sent", title: "INV-024 · Aster House", when: "Aug 21", tone: "amber" },
  { kind: "Payment recorded", title: "₹48,000 · Northline Studio", when: "Aug 14", tone: "green" },
  { kind: "Agreement accepted", title: "Research engagement", when: "Aug 12", tone: "blue" },
  { kind: "Client added", title: "Meridian Labs", when: "Aug 09", tone: "green" },
  { kind: "Project created", title: "Q3 design retainer", when: "Aug 08", tone: "blue" },
] as const;

export const projectTabs = [
  { label: "All work", count: "6", active: true },
  { label: "In progress", count: "3", active: false },
  { label: "Paused", count: "1", active: false },
  { label: "Completed", count: "2", active: false },
] as const;

export const projectGroups = [
  {
    label: "This week",
    projects: [
      { title: "Website launch", client: "Aster House", note: "Marketing site redesign & CMS handoff", priority: "High", priorityTone: "warning", status: "In progress", statusTone: "info", rail: "blue", due: "Due Thursday", dueTone: "warning", pct: "66%", milestones: "4/6 milestones", budget: "₹90,000", contract: "Rive contract · in review", contractTone: "warning" },
      { title: "Brand system", client: "Northline Studio", note: "Identity, guidelines & asset kit", priority: "Medium", priorityTone: "muted", status: "In progress", statusTone: "info", rail: "blue", due: "Milestone Friday", dueTone: "warning", pct: "40%", milestones: "2/5 milestones", budget: "₹96,000", contract: "Rive contract · accepted", contractTone: "success" },
    ],
  },
  {
    label: "Later",
    projects: [
      { title: "Research sprint", client: "Field Notes", note: "Discovery interviews & synthesis", priority: "Low", priorityTone: "info", status: "In progress", statusTone: "info", rail: "blue", due: "Due Sep 04", dueTone: "muted", pct: "75%", milestones: "3/4 milestones", budget: "₹72,000", contract: "Contract undecided", contractTone: "warning" },
      { title: "Q3 design retainer", client: "Meridian Labs", note: "Ongoing product design support", priority: "Medium", priorityTone: "muted", status: "Paused", statusTone: "warning", rail: "amber", due: "No deadline", dueTone: "muted", pct: null, milestones: "No milestones", budget: "₹36,500", contract: "Review draft", contractTone: "muted" },
    ],
  },
] as const;

export const agreementSummary = [
  { label: "Needs your action", value: "1", Icon: Sparkles, tone: "blue" },
  { label: "With clients", value: "1", Icon: MessageSquareText, tone: "amber" },
  { label: "Acceptance", value: "1", Icon: FileSignature, tone: "violet" },
  { label: "Accepted", value: "2", Icon: FileCheck2, tone: "green" },
] as const;

export const agreementRows = [
  { title: "Website launch agreement", client: "Aster House", project: "Website launch", action: "Open review workspace", hint: "Waiting for comments", stage: "In review", tone: "warning" },
  { title: "Brand system terms", client: "Northline Studio", project: "Brand system", action: "Waiting for client", hint: "1 of 2 accepted", stage: "Acceptance", tone: "info" },
  { title: "Research engagement", client: "Field Notes", project: "Research sprint", action: "View agreement & invoices", hint: "Accepted Aug 12", stage: "Accepted", tone: "success" },
] as const;

export const revenueSummary = [
  { label: "Total invoiced", value: "₹4,11,000", Icon: FileText, tone: "blue" },
  { label: "Collected", value: "₹2,84,500", Icon: WalletCards, tone: "green" },
  { label: "Outstanding", value: "₹90,000", Icon: Clock3, tone: "amber" },
  { label: "Overdue", value: "₹36,500", Icon: AlertTriangle, tone: "red" },
  { label: "Draft pipeline", value: "₹72,000", Icon: FileText, tone: "slate" },
] as const;

export const invoiceRows = [
  { number: "INV-024", issued: "Issued Aug 21", client: "Aster House", project: "Website launch", due: "Due Aug 28", amount: "₹90,000", status: "Sent", tone: "info" },
  { number: "INV-021", issued: "Issued Jul 22", client: "Meridian Labs", project: "Q3 design retainer", due: "Due Aug 05", amount: "₹36,500", status: "Overdue", tone: "danger" },
  { number: "INV-019", issued: "Issued Aug 02", client: "Northline Studio", project: "Brand system", due: "Paid Aug 14", amount: "₹48,000", status: "Paid", tone: "success" },
  { number: "INV-017", issued: "Issued Aug 10", client: "Field Notes", project: "Research sprint", due: "No due date", amount: "₹72,000", status: "Draft", tone: "muted" },
] as const;

export const calendarWeek = [
  { name: "Mon", num: "10", today: false, events: [{ time: "10:00", title: "Homepage review · Aster", tone: "blue" }, { time: "15:30", title: "Invoice follow-up", tone: "blue" }] },
  { name: "Tue", num: "11", today: true, events: [{ time: "09:30", title: "Focus · Brand concepts", tone: "teal" }] },
  { name: "Wed", num: "12", today: false, events: [{ time: "All day", title: "INV-024 due · ₹90,000", tone: "amber" }, { time: "14:00", title: "Client call · Field Notes", tone: "blue" }] },
  { name: "Thu", num: "13", today: false, events: [{ time: "11:00", title: "Milestone delivery · Northline", tone: "violet" }] },
  { name: "Fri", num: "14", today: false, events: [{ time: "All day", title: "Brand system · milestone", tone: "amber" }] },
  { name: "Sat", num: "15", today: false, events: [] },
  { name: "Sun", num: "16", today: false, events: [] },
] as const;

export const planningQueue = [
  { title: "Prepare Meridian proposal", meta: "45 min" },
  { title: "Send invoice reminder", meta: "15 min" },
] as const;

export const studioSections = [
  { label: "Selected work", sub: "3 projects", Icon: FolderKanban, active: true },
  { label: "Profile", sub: "Identity & contact", Icon: UserRound, active: false },
  { label: "Services", sub: "2 services", Icon: BriefcaseBusiness, active: false },
  { label: "Testimonials", sub: "2 added", Icon: Sparkles, active: false },
  { label: "Appearance", sub: "Theme & visibility", Icon: Settings2, active: false },
] as const;

export const studioWork = [
  { index: "01", title: "Website launch", meta: "Aster House · Product design", visibility: "Public", tone: "success" },
  { index: "02", title: "Brand system", meta: "Northline Studio · Brand identity", visibility: "Public", tone: "success" },
  { index: "03", title: "Research sprint", meta: "Field Notes · UX research", visibility: "Private", tone: "muted" },
] as const;

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

export function MetricCard({ label, value, sub, Icon, tone }: { label: string; value: string; sub?: string; Icon: LucideIcon; tone: string }) {
  return (
    <div className="wp-metric">
      <div><span>{label}</span><i data-tone={tone}><Icon /></i></div>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

export function Toolbar({ searchPlaceholder, selectLabel, selectValue }: { searchPlaceholder: string; selectLabel: string; selectValue: string }) {
  return (
    <div className="wp-toolbar">
      <span className="wp-search"><Search />{searchPlaceholder}</span>
      <span className="wp-toolbar__right"><small>{selectLabel}</small><span className="wp-select">{selectValue}<ChevronDown /></span></span>
    </div>
  );
}

function DashboardView() {
  return (
    <>
      <div className="wp-metrics">
        {dashboardMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
      <div className="wp-panels wp-fill">
        <section className="wp-card">
          <div className="wp-card__head"><h3><Activity />Recent activity</h3><span className="wp-badge" data-tone="muted">Updates automatically</span></div>
          <ul className="wp-activity">
            {dashboardActivity.map((item) => (
              <li key={item.title}><i data-tone={item.tone}>{item.kind}</i><span>{item.title}</span><time>{item.when}</time></li>
            ))}
          </ul>
        </section>
        <section className="wp-card">
          <div className="wp-card__head"><h3>Top clients</h3><span className="wp-link">View all<ChevronRight /></span></div>
          <ul className="wp-people">
            {seededClients.slice(0, 4).map((client) => (
              <li key={client.name}><i className="wp-avatar" style={{ background: client.color }}>{initials(client.name)}</i><span><b>{client.name}</b><small>{client.company}</small></span><strong>{client.paid}</strong></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function ClientsView() {
  return (
    <>
      <Toolbar searchPlaceholder="Search by name, email, company…" selectLabel="Status" selectValue="All clients" />
      <div className="wp-client-grid wp-fill">
        {seededClients.map((client) => (
          <article className="wp-client" key={client.name}>
            <div className="wp-client__head">
              <i className="wp-avatar" style={{ background: client.color }}>{initials(client.name)}</i>
              <div><b>{client.name}</b><small>{client.company}</small></div>
              <span className="wp-badge" data-tone={client.status === "Active" ? "success" : "muted"}>{client.status}</span>
            </div>
            <p className="wp-client__contact"><Mail />{client.email}</p>
            <div className="wp-client__foot"><span><Briefcase />{client.projects}</span><strong><CircleDollarSign />{client.paid} paid</strong></div>
          </article>
        ))}
      </div>
    </>
  );
}

function ProjectsView() {
  return (
    <>
      <Toolbar searchPlaceholder="Search by title, description…" selectLabel="Sort" selectValue="Deadline first" />
      <div className="wp-tabs">
        {projectTabs.map((tab) => <span key={tab.label} className={`wp-tab${tab.active ? " is-active" : ""}`}>{tab.label}<b>{tab.count}</b></span>)}
        <span className="wp-tab wp-tab--alert"><AlertTriangle />1 overdue</span>
      </div>
      <div className="wp-fill">
        {projectGroups.map((group) => (
          <section key={group.label}>
            <p className="wp-bucket">{group.label}</p>
            {group.projects.map((project) => (
              <article className="wp-project" key={project.title}>
                <i className="wp-project__rail" data-tone={project.rail} />
                <div className="wp-project__body">
                  <div className="wp-project__top">
                    <b>{project.title}</b>
                    <span className="wp-badge" data-tone={project.priorityTone}>{project.priority}</span>
                    <span className="wp-status" data-tone={project.statusTone}><i />{project.status}<ChevronDown /></span>
                  </div>
                  <p className="wp-project__meta"><UserRound /><b>{project.client}</b>· {project.note}</p>
                  <div className="wp-project__foot">
                    <span className="wp-due" data-tone={project.dueTone}>{project.due}</span>
                    <span className="wp-progress">{project.pct ? <i><b style={{ width: project.pct }} /></i> : null}<em>{project.milestones}</em></span>
                    <strong className="wp-budget">{project.budget}</strong>
                    <span className="wp-contract" data-tone={project.contractTone}><FileSignature />{project.contract}</span>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

function AgreementsView() {
  return (
    <>
      <div className="wp-metrics">
        {agreementSummary.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
      <div className="wp-notice">
        <AlertTriangle />
        <div><b>1 active project needs an agreement decision</b><small>Start with the existing client, brief, milestones, and currency.</small></div>
        <span className="wp-notice__action">Review projects</span>
      </div>
      <div className="wp-rows wp-rows--agreements wp-fill">
        <div className="wp-rows__head"><span>Agreement</span><span>Next action</span><span>Stage</span></div>
        {agreementRows.map((row) => (
          <div className="wp-line" key={row.title}>
            <span className="wp-line__main"><i className="wp-docicon"><FileSignature /></i><span><b>{row.title}</b><small>{row.client} · {row.project}</small></span></span>
            <span className="wp-line__action"><b>{row.action}</b><small>{row.hint}</small></span>
            <span className="wp-badge" data-tone={row.tone}>{row.stage}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function RevenueView() {
  return (
    <>
      <div className="wp-metrics wp-metrics--five">
        {revenueSummary.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
      <div className="wp-health">
        <div><span>Collection health</span><strong>69% collected</strong></div>
        <i><b style={{ width: "69%" }} /></i>
      </div>
      <div className="wp-rows wp-rows--invoices wp-fill">
        <div className="wp-rows__head"><span>Invoice</span><span className="wp-hide-sm">Client / project</span><span className="wp-hide-sm">Due</span><span>Amount</span><span>Status</span></div>
        {invoiceRows.map((row) => (
          <div className="wp-line" key={row.number}>
            <span className="wp-line__main"><i className="wp-docicon"><FileText /></i><span><b>{row.number}</b><small>{row.issued}</small></span></span>
            <span className="wp-line__action wp-hide-sm"><b>{row.client}</b><small>{row.project}</small></span>
            <span className="wp-line__due wp-hide-sm">{row.due}</span>
            <span className="wp-amount">{row.amount}</span>
            <span className="wp-badge" data-tone={row.tone}>{row.status}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function CalendarView() {
  return (
    <>
      <div className="wp-cal wp-fill">
        <div className="wp-cal__tools">
          <i><ChevronLeft /></i>
          <i><ChevronRight /></i>
          <span className="wp-cal__today">Today</span>
          <strong>August 2026</strong>
          <div className="wp-cal__views"><span>month</span><span className="active">week</span><span>agenda</span></div>
        </div>
        <div className="wp-cal__week">
          {calendarWeek.map((day) => (
            <div className="wp-cal__day" data-today={day.today || undefined} key={day.num}>
              <b><small>{day.name}</small><u>{day.num}</u></b>
              <div className="wp-cal__events">
                {day.events.map((event) => <i className="wp-cal__event" data-tone={event.tone} key={event.title}><time>{event.time}</time>{event.title}</i>)}
              </div>
            </div>
          ))}
        </div>
        <div className="wp-queue">
          <b>Planning queue</b>
          {planningQueue.map((task) => <span key={task.title}><i />{task.title} · {task.meta}<em>Schedule</em></span>)}
        </div>
      </div>
    </>
  );
}

function PortfolioView() {
  return (
    <>
      <div className="wp-studio__tabs">
        <span className="active"><FolderKanban />Editor</span>
        <span><BarChart3 />Analytics</span>
        <span><Inbox />Enquiries <i className="wp-count">2</i></span>
        <span className="wp-studio__status"><i /><b>Published</b> · rive.site/p/maya-rao</span>
      </div>
      <div className="wp-studio__shell wp-fill">
        <nav>
          {studioSections.map((section) => (
            <span className={section.active ? "active" : ""} key={section.label}><section.Icon /><span><b>{section.label}</b><small>{section.sub}</small></span></span>
          ))}
          <div className="wp-studio__readiness">
            <div><span>Readiness</span><strong>86%</strong></div>
            <i><b style={{ width: "86%" }} /></i>
            <small>6 of 7 signals complete.</small>
          </div>
        </nav>
        <div className="wp-studio__panel">
          <p className="wp-panel__kicker">Selected work</p>
          <h3>Choose the work that represents you.</h3>
          {studioWork.map((work) => (
            <article className="wp-work" key={work.index}>
              <span>{work.index}</span>
              <div><strong>{work.title}</strong><small>{work.meta}</small></div>
              <b className="wp-badge" data-tone={work.tone}>{work.visibility}</b>
            </article>
          ))}
          <span className="wp-work-add"><Plus />Add project</span>
        </div>
      </div>
    </>
  );
}

const views: Record<WorkspacePreviewView, ComponentType> = {
  dashboard: DashboardView,
  clients: ClientsView,
  projects: ProjectsView,
  agreements: AgreementsView,
  revenue: RevenueView,
  calendar: CalendarView,
  portfolio: PortfolioView,
};

export function WorkspacePreview({ view, className = "" }: { view: WorkspacePreviewView; className?: string }) {
  const page = pageCopy[view];
  const ViewContent = views[view];
  return (
    <div className={`workspace-preview workspace-preview--full ${className}`} data-workspace-preview={view} role="img" aria-label="Rive product preview">
      <div className="workspace-preview__topbar"><div className="wp-wordmark"><RiveLogo height={24} /><span>Free</span></div><span><Search />Search workspace…</span><div><span>Display&nbsp;&nbsp; INR · Indian rupee</span><Moon /><Bell /></div></div>
      <div className="workspace-preview__body">
        <aside>{navigation.map(([id, label, Icon]) => <span key={id} className={id === view ? "active" : ""}><Icon />{label}</span>)}<div><i>MR</i><span><b>Maya Rao</b><small>Independent studio</small></span></div></aside>
        <main>
          <header>
            <div><h2>{page.title}</h2><p>{page.description}</p></div>
            <div className="wp-actions">
              {page.secondary && page.SecondaryIcon ? <button type="button" tabIndex={-1} className="wp-btn-ghost"><page.SecondaryIcon />{page.secondary}</button> : null}
              <button type="button" tabIndex={-1}><page.ActionIcon />{page.action}</button>
            </div>
          </header>
          <ViewContent />
        </main>
      </div>
    </div>
  );
}
