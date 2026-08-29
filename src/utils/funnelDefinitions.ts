import {
  REAL_DATA_EVENT_NAMES,
  REAL_DATA_ORIGINS,
} from "@/lib/analytics/eventContracts";

export { PRODUCT_EVENT_NAMES, REAL_DATA_EVENT_NAMES, REAL_DATA_ORIGINS } from "@/lib/analytics/eventContracts";

/**
 * Versioned product-funnel rules. Keep the admin dashboard, user explorer, and
 * future warehouse export on this contract instead of re-implementing it in
 * individual routes.
 */
export const FUNNEL_DEFINITION_VERSION = "v1";

export const INTERNAL_ACCOUNT_TYPES = new Set(["internal", "test", "demo", "e2e", "synthetic"]);
export const MEANINGFUL_PRODUCT_EVENTS = new Set([
  "workspace_viewed",
  ...REAL_DATA_EVENT_NAMES,
  "invoice_sent",
  "calendar_used",
  "import_review_completed",
  "agreement_reviewed",
  "agreement_accepted",
  "invoice_viewed",
  "payment_recorded",
]);

type AttributionLike = {
  firstTouchSource: string | null;
  lastTouchSource: string | null;
  referralSource: string | null;
} | null;

export type QualificationUser = {
  accountType?: string | null;
  emailVerifiedAt: Date | null;
  emailVerificationRequiredAt: Date | null;
  onboardingStatus: string;
  businessType: string | null;
  profession: string | null;
  onboardingData: unknown;
  attribution: AttributionLike;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function acquisitionSource(user: Pick<QualificationUser, "attribution">): string {
  return user.attribution?.firstTouchSource || user.attribution?.lastTouchSource || user.attribution?.referralSource || "uncaptured";
}

export type QualificationBlocker =
  | "internal"
  | "email_not_ready"
  | "onboarding_incomplete"
  | "missing_business_type"
  | "missing_profession"
  | "missing_goal"
  | "missing_starting_path"
  | "uncaptured_source";

export function qualificationBlockers(user: QualificationUser): QualificationBlocker[] {
  const blockers: QualificationBlocker[] = [];
  if (user.accountType && INTERNAL_ACCOUNT_TYPES.has(user.accountType)) blockers.push("internal");
  const onboarding = isRecord(user.onboardingData) ? user.onboardingData : {};
  const emailReady = !user.emailVerificationRequiredAt || Boolean(user.emailVerifiedAt);
  if (!emailReady) blockers.push("email_not_ready");
  if (!["complete", "skipped"].includes(user.onboardingStatus)) blockers.push("onboarding_incomplete");
  if (!user.businessType?.trim()) blockers.push("missing_business_type");
  if (!user.profession?.trim()) blockers.push("missing_profession");
  if (typeof onboarding.goal !== "string" || !onboarding.goal.trim()) blockers.push("missing_goal");
  if (typeof onboarding.startingPath !== "string" || !onboarding.startingPath.trim()) blockers.push("missing_starting_path");
  if (acquisitionSource(user) === "uncaptured") blockers.push("uncaptured_source");
  return blockers;
}

export function isQualifiedUser(user: QualificationUser): boolean {
  return qualificationBlockers(user).length === 0;
}

export const ACTIVATION_WINDOW_DAYS = 7;

export function withinDays(date: Date | string | null | undefined, start: Date, days: number): boolean {
  if (date == null) return false;
  const time = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (!Number.isFinite(time)) return false;
  return time >= start.getTime() && time <= start.getTime() + days * 24 * 60 * 60 * 1000;
}

export type ActivationFacts = {
  signupAt: Date;
  clients: Array<{ id: string; createdAt: Date }>;
  projects: Array<{ id: string; clientId: string | null; dueDate: Date | string | null; createdAt: Date }>;
  invoices: Array<{ projectId: string | null; clientId: string | null; createdAt: Date }>;
  expenses: Array<{ projectId: string | null; createdAt: Date }>;
  calendarEvents: Array<{ projectId: string | null; clientId: string | null; createdAt: Date }>;
  importJobs: Array<{ completedAt: Date | null; createdAt: Date; unresolvedCount: number; records: Array<{ targetType: string }> }>;
  portfolios: Array<{ publishedAt: Date | null; content: unknown }>;
};

export type ActivationBlocker =
  | "no_client_in_window"
  | "no_linked_project_in_window"
  | "no_connected_outcome"
  | "migration_incomplete"
  | "portfolio_incomplete";

export type ActivationPath = "native" | "migration" | "portfolio";

export function evaluateActivation(facts: ActivationFacts): {
  activated: boolean;
  native: boolean;
  migration: boolean;
  portfolio: boolean;
  paths: ActivationPath[];
  blockers: ActivationBlocker[];
} {
  const start = facts.signupAt;
  const eligibleClients = facts.clients.filter((record) => withinDays(record.createdAt, start, ACTIVATION_WINDOW_DAYS));
  const eligibleProjects = facts.projects.filter((record) => (
    withinDays(record.createdAt, start, ACTIVATION_WINDOW_DAYS)
    && Boolean(record.clientId)
    && eligibleClients.some((client) => client.id === record.clientId)
  ));
  const connectedProjectIds = new Set(eligibleProjects.map((project) => project.id));
  const connectedClientIds = new Set(eligibleClients.map((client) => client.id));
  const nativeDeadline = eligibleProjects.some((project) => countsAsNativeDeadline(project));
  const nativeOutcome = nativeDeadline
    || facts.invoices.some((invoice) => withinDays(invoice.createdAt, start, ACTIVATION_WINDOW_DAYS) && (connectedProjectIds.has(invoice.projectId || "") || connectedClientIds.has(invoice.clientId || "")))
    || facts.expenses.some((expense) => withinDays(expense.createdAt, start, ACTIVATION_WINDOW_DAYS) && connectedProjectIds.has(expense.projectId || ""))
    || facts.calendarEvents.some((event) => withinDays(event.createdAt, start, ACTIVATION_WINDOW_DAYS) && (connectedProjectIds.has(event.projectId || "") || connectedClientIds.has(event.clientId || "")));
  const native = eligibleClients.length > 0 && eligibleProjects.length > 0 && nativeOutcome;
  const migration = facts.importJobs.some((job) => (
    withinDays(job.completedAt || job.createdAt, start, ACTIVATION_WINDOW_DAYS)
    && job.unresolvedCount === 0
    && new Set(job.records.map((record) => record.targetType)).size >= 2
  ));
  const realProjectIds = new Set(facts.projects.map((project) => `project-${project.id}`));
  const portfolio = facts.portfolios.some((item) => {
    if (!withinDays(item.publishedAt, start, ACTIVATION_WINDOW_DAYS)) return false;
    const content = isRecord(item.content) ? item.content : {};
    const contact = typeof content.contactEmail === "string" && Boolean(content.contactEmail.trim());
    const projectsInPortfolio = Array.isArray(content.projects) && content.projects.some((project) => (
      isRecord(project)
      && typeof project.id === "string"
      && realProjectIds.has(project.id)
      && project.visibility !== "private"
      && typeof project.title === "string"
      && Boolean(project.title.trim())
    ));
    return contact && projectsInPortfolio;
  });
  const paths: ActivationPath[] = [];
  if (native) paths.push("native");
  if (migration) paths.push("migration");
  if (portfolio) paths.push("portfolio");
  const activated = paths.length > 0;
  const blockers: ActivationBlocker[] = [];
  if (!activated) {
    if (eligibleClients.length === 0) blockers.push("no_client_in_window");
    if (eligibleProjects.length === 0) blockers.push("no_linked_project_in_window");
    if (!nativeOutcome) blockers.push("no_connected_outcome");
    if (!migration) blockers.push("migration_incomplete");
    if (!portfolio) blockers.push("portfolio_incomplete");
  }
  return { activated, native, migration, portfolio, paths, blockers };
}

export function isMeaningfulProductEvent(event: { eventName: string; properties: unknown }): boolean {
  if (event.eventName !== "page_viewed") return MEANINGFUL_PRODUCT_EVENTS.has(event.eventName);
  const properties = isRecord(event.properties) ? event.properties : {};
  const path = typeof properties.path === "string" ? properties.path : "";
  return ["/dashboard", "/workflow", "/calendar", "/portfolio"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isRealDataEvent(event: { eventName: string; dataOrigin?: string | null }): boolean {
  return Boolean(event.dataOrigin && REAL_DATA_ORIGINS.has(event.dataOrigin) && REAL_DATA_EVENT_NAMES.has(event.eventName));
}

export function countsAsNativeDeadline(project: { dueDate: Date | string | null | undefined }): boolean {
  return project.dueDate != null;
}

export function hasRealDataRecords(counts: {
  clients: number;
  projects: number;
  invoices: number;
  expenses: number;
  calendarEvents: number;
}): boolean {
  return counts.clients + counts.projects + counts.invoices + counts.expenses + counts.calendarEvents > 0;
}

export type FunnelUserSummary = {
  qualified: boolean;
  activated: boolean;
  realData: boolean;
  qualificationBlockers: QualificationBlocker[];
  activationPaths: ActivationPath[];
  activationBlockers: ActivationBlocker[];
  stage: "registered" | "qualified" | "activated";
};

export function summarizeFunnelUser(input: {
  user: QualificationUser;
  activation: ReturnType<typeof evaluateActivation>;
  realData: boolean;
}): FunnelUserSummary {
  const blockers = qualificationBlockers(input.user);
  const qualified = blockers.length === 0;
  const activated = qualified && input.activation.activated;
  const stage = activated ? "activated" : qualified ? "qualified" : "registered";
  return {
    qualified,
    activated,
    realData: input.realData,
    qualificationBlockers: blockers,
    activationPaths: input.activation.paths,
    activationBlockers: activated ? [] : input.activation.blockers,
    stage,
  };
}
