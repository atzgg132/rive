import {
  Activity,
  Bell,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileSignature,
  FileText,
  Mail,
  Moon,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { RiveLogo } from "@/components/RiveLogo";
import {
  type WorkspacePreviewView,
  pageCopy,
  seededClients,
  dashboardMetrics,
  dashboardActivity,
  projectGroups,
  agreementSummary,
  agreementRows,
  revenueSummary,
  invoiceRows,
  calendarWeek,
  studioWork,
  initials,
  MetricCard,
} from "./WorkspacePreview";

/* ------------------------------------------------------------------ */
/* Compact views — essential data only, same product language.        */
/* ------------------------------------------------------------------ */

function CompactDashboardView() {
  return (
    <>
      <div className="wp-metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(7.5rem, 1fr))" }}>
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
      <section className="wp-card" style={{ marginTop: "0.8rem" }}>
        <div className="wp-card__head">
          <h3>
            <Activity />
            Recent activity
          </h3>
        </div>
        <ul className="wp-activity">
          {dashboardActivity.slice(0, 3).map((item) => (
            <li key={item.title}>
              <i data-tone={item.tone}>{item.kind}</i>
              <span>{item.title}</span>
              <time>{item.when}</time>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function CompactClientsView() {
  return (
    <div className="wp-client-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(9.5rem, 1fr))" }}>
      {seededClients.slice(0, 3).map((client) => (
        <article className="wp-client" key={client.name}>
          <div className="wp-client__head">
            <i className="wp-avatar" style={{ background: client.color }}>
              {initials(client.name)}
            </i>
            <div>
              <b>{client.name}</b>
              <small>{client.company}</small>
            </div>
            <span className="wp-badge" data-tone={client.status === "Active" ? "success" : "muted"}>
              {client.status}
            </span>
          </div>
          <p className="wp-client__contact">
            <Mail />
            {client.email}
          </p>
          <div className="wp-client__foot">
            <span>
              <Briefcase />
              {client.projects}
            </span>
            <strong>
              <CircleDollarSign />
              {client.paid} paid
            </strong>
          </div>
        </article>
      ))}
    </div>
  );
}

function CompactProjectsView() {
  const project = projectGroups[0].projects[0];
  return (
    <article className="wp-project" style={{ marginTop: 0 }}>
      <i className="wp-project__rail" data-tone={project.rail} />
      <div className="wp-project__body">
        <div className="wp-project__top">
          <b>{project.title}</b>
          <span className="wp-badge" data-tone={project.priorityTone}>
            {project.priority}
          </span>
          <span className="wp-status" data-tone={project.statusTone}>
            <i />
            {project.status}
            <ChevronDown />
          </span>
        </div>
        <p className="wp-project__meta">
          <UserRound />
          <b>{project.client}</b>· {project.note}
        </p>
        <div className="wp-project__foot">
          <span className="wp-due" data-tone={project.dueTone}>
            {project.due}
          </span>
          <span className="wp-progress">
            {project.pct ? (
              <i>
                <b style={{ width: project.pct }} />
              </i>
            ) : null}
            <em>{project.milestones}</em>
          </span>
          <strong className="wp-budget">{project.budget}</strong>
          <span className="wp-contract" data-tone={project.contractTone}>
            <FileSignature />
            {project.contract}
          </span>
        </div>
      </div>
    </article>
  );
}

function CompactAgreementsView() {
  const row = agreementRows[0];
  return (
    <>
      <div className="wp-metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(7.5rem, 1fr))" }}>
        <MetricCard {...agreementSummary[0]} />
      </div>
      <div className="wp-rows wp-rows--agreements" style={{ marginTop: "0.8rem" }}>
        <div className="wp-rows__head">
          <span>Agreement</span>
          <span>Next action</span>
          <span>Stage</span>
        </div>
        <div className="wp-line" key={row.title}>
          <span className="wp-line__main">
            <i className="wp-docicon">
              <FileSignature />
            </i>
            <span>
              <b>{row.title}</b>
              <small>
                {row.client} · {row.project}
              </small>
            </span>
          </span>
          <span className="wp-line__action">
            <b>{row.action}</b>
            <small>{row.hint}</small>
          </span>
          <span className="wp-badge" data-tone={row.tone}>
            {row.stage}
          </span>
        </div>
      </div>
    </>
  );
}

function CompactRevenueView() {
  return (
    <>
      <div className="wp-metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(7.5rem, 1fr))" }}>
        {revenueSummary.slice(0, 3).map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
      <div className="wp-rows wp-rows--invoices" style={{ marginTop: "0.8rem" }}>
        <div className="wp-rows__head">
          <span>Invoice</span>
          <span className="wp-hide-sm">Client / project</span>
          <span className="wp-hide-sm">Due</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        {invoiceRows.slice(0, 2).map((row) => (
          <div className="wp-line" key={row.number}>
            <span className="wp-line__main">
              <i className="wp-docicon">
                <FileText />
              </i>
              <span>
                <b>{row.number}</b>
                <small>{row.issued}</small>
              </span>
            </span>
            <span className="wp-line__action wp-hide-sm">
              <b>{row.client}</b>
              <small>{row.project}</small>
            </span>
            <span className="wp-line__due wp-hide-sm">{row.due}</span>
            <span className="wp-amount">{row.amount}</span>
            <span className="wp-badge" data-tone={row.tone}>
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function CompactCalendarView() {
  const days = calendarWeek.slice(1, 4);
  return (
    <div className="wp-cal">
      <div className="wp-cal__tools">
        <i>
          <ChevronLeft />
        </i>
        <i>
          <ChevronRight />
        </i>
        <span className="wp-cal__today">Today</span>
        <strong>August 2026</strong>
        <div className="wp-cal__views">
          <span>month</span>
          <span className="active">week</span>
          <span>agenda</span>
        </div>
      </div>
      <div className="wp-cal__week" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {days.map((day) => (
          <div className="wp-cal__day" data-today={day.today || undefined} key={day.num}>
            <b>
              <small>{day.name}</small>
              <u>{day.num}</u>
            </b>
            <div className="wp-cal__events">
              {day.events.map((event) => (
                <i className="wp-cal__event" data-tone={event.tone} key={event.title}>
                  <time>{event.time}</time>
                  {event.title}
                </i>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactPortfolioView() {
  return (
    <div className="wp-studio__panel" style={{ border: 0, padding: 0 }}>
      <div className="wp-studio__status" style={{ marginBottom: "0.5rem" }}>
        <i />
        <b>Published</b> · rive.site/p/maya-rao
      </div>
      <p className="wp-panel__kicker">Selected work</p>
      {studioWork.slice(0, 2).map((work) => (
        <article className="wp-work" key={work.index}>
          <span>{work.index}</span>
          <div>
            <strong>{work.title}</strong>
            <small>{work.meta}</small>
          </div>
          <b className="wp-badge" data-tone={work.tone}>
            {work.visibility}
          </b>
        </article>
      ))}
      <span className="wp-work-add">
        <Plus />
        Add project
      </span>
    </div>
  );
}

const compactViews = {
  dashboard: CompactDashboardView,
  clients: CompactClientsView,
  projects: CompactProjectsView,
  agreements: CompactAgreementsView,
  revenue: CompactRevenueView,
  calendar: CompactCalendarView,
  portfolio: CompactPortfolioView,
} as const;

/* ------------------------------------------------------------------ */
/* Shell                                                              */
/* ------------------------------------------------------------------ */

export function WorkspacePreviewCompact({ view, className = "" }: { view: WorkspacePreviewView; className?: string }) {
  const page = pageCopy[view];
  const ViewContent = compactViews[view];
  return (
    <div
      className={`workspace-preview workspace-preview--compact ${className}`}
      data-workspace-preview={view}
      role="img"
      aria-label="Rive product preview"
    >
      <div className="workspace-preview__topbar">
        <div className="wp-wordmark">
          <RiveLogo height={24} />
          <span>Free</span>
        </div>
        <span>
          <Search />
          Search workspace…
        </span>
        <div>
          <span>
            Display&nbsp;&nbsp; INR · Indian rupee
          </span>
          <Moon />
          <Bell />
        </div>
      </div>
      <div className="workspace-preview__body">
        <main>
          <header>
            <div>
              <h2>{page.title}</h2>
              <p>{page.description}</p>
            </div>
            <div className="wp-actions">
              {page.secondary && page.SecondaryIcon ? (
                <button type="button" className="wp-btn-ghost">
                  <page.SecondaryIcon />
                  {page.secondary}
                </button>
              ) : null}
              <button type="button">
                <page.ActionIcon />
                {page.action}
              </button>
            </div>
          </header>
          <ViewContent />
        </main>
      </div>
    </div>
  );
}
