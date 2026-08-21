import {
  ACTIVATION_GOAL_META,
  type ActivationAction,
  type ActivationMilestone,
  type ActivationPlan,
  type ActivationStage,
  type GuideProgressMap,
  normalizeActivationGoal,
  normalizeStartingPath,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./activation.ts";

export type ActivationPlanInput = {
  goal?: unknown;
  startingPath?: unknown;
  guidanceDismissed?: unknown;
  guidanceCompleted?: unknown;
  counts: { clients: number; projects: number; invoices: number; expenses: number };
  profileReady: boolean;
  selectedPortfolioProject: boolean;
  publishedPortfolio: boolean;
  projectDeadlineCount: number;
  sentInvoiceCount: number;
  calendarConnectionCount: number;
  importJobCount: number;
  /** Completed migration-engine sessions with at least one imported/link record. */
  completedImportJobCount?: number;
  /** Unfinished migration-engine sessions, used to avoid opening a new import over a review. */
  activeImportJobCount?: number;
  unresolvedImportIssues: number;
  /**
   * Where "import your work" should send the user. Passed in rather than read
   * from the environment so this module stays pure and testable; the caller
   * supplies the migration route when the engine is switched on.
   */
  migrationHref?: string;
  /** Direct resume URL for the latest review-required migration, when one exists. */
  migrationReviewHref?: string;
  guideProgress?: GuideProgressMap;
};

const DEFAULT_IMPORT_HREF = "/migrate";

function activationAction(id: string, label: string, description: string, href: string): ActivationAction {
  return { id, label, description, href };
}

function milestone(id: string, label: string, complete: boolean, href: string): ActivationMilestone {
  return { id, label, complete, href };
}

function pickSecondaryActions(recommended: ActivationAction | null, candidates: ActivationAction[]): ActivationAction[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (recommended?.id === candidate.id || seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  }).slice(0, 2);
}

export function buildActivationPlan(input: ActivationPlanInput): ActivationPlan {
  const goal = normalizeActivationGoal(input.goal);
  const startingPath = normalizeStartingPath(input.startingPath);
  const guidanceDismissed = input.guidanceDismissed === true;
  const guidanceCompleted = input.guidanceCompleted === true;
  const { counts } = input;
  // Keep the old `importJobCount` input as a compatibility fallback for
  // callers/tests that predate the engine-aware counts. The API now passes the
  // completed count so an abandoned or review-only upload never masquerades as
  // imported work.
  const importedWorkCount = typeof input.completedImportJobCount === "number"
    ? input.completedImportJobCount
    : input.importJobCount;
  const hasImportedWork = importedWorkCount > 0;
  const hasFinancialContext = counts.invoices > 0 || counts.expenses > 0;
  const hasMeaningfulContext = Boolean(counts.clients > 0 || counts.projects > 0 || hasFinancialContext || input.calendarConnectionCount > 0 || input.publishedPortfolio);

  let milestones: ActivationMilestone[];
  let recommendedAction: ActivationAction | null = null;
  let secondaryCandidates: ActivationAction[] = [];
  const addClient = activationAction("first_client", "Add your first client", "Keep the relationship, projects and invoices connected.", "/workflow/clients?new=true");
  const createProject = activationAction("first_project", "Create your first project", "Give active work a client, deadline and financial context.", "/workflow/projects?new=true");
  const addDeadline = activationAction("add_deadline", "Add a project deadline", "Deadlines flow into your calendar and next-action view.", "/workflow/projects");
  const connectCalendar = activationAction("connect_calendar", "Connect your calendar", "Keep project milestones and scheduled work visible together.", "/calendar");
  const createInvoice = activationAction("create_invoice", "Create your first invoice", "Reuse the client, project and currency you already entered.", "/workflow/invoices/new");
  const sendInvoice = activationAction("send_invoice", "Review and send an invoice", "A sent invoice is the first step toward getting paid.", "/workflow/revenue");
  const addExpense = activationAction("add_expense", "Log your first expense", "Project-linked costs make profitability easier to understand.", "/workflow/expenses?new=true");
  const importHref = typeof input.migrationHref === "string" && input.migrationHref ? input.migrationHref : DEFAULT_IMPORT_HREF;
  const reviewHref = typeof input.migrationReviewHref === "string" && input.migrationReviewHref ? input.migrationReviewHref : importHref;
  const importWork = activationAction("import_work", "Import your work", "Bring existing records across with a preview and rollback path.", importHref);
  const resolveImport = activationAction("resolve_import", "Resolve imported records", "Review unresolved relationships before relying on the totals.", reviewHref);
  const completeProfile = activationAction("complete_profile", "Complete your profile", "Your profile becomes the foundation for public proof of work.", "/portfolio");
  const selectProject = activationAction("select_project", "Select a project for your portfolio", "Choose real work that helps prospective clients understand you.", "/portfolio");
  const publishPortfolio = activationAction("publish_portfolio", "Publish your portfolio", "Make the proof you have prepared available to the people you want to reach.", "/portfolio");

  switch (goal) {
    case "get_paid":
      milestones = [
        milestone("client", "First client", counts.clients > 0, "/workflow/clients"),
        milestone("project", "Active work", counts.projects > 0, "/workflow/projects"),
        milestone("invoice", "Invoice ready", counts.invoices > 0, "/workflow/revenue"),
        milestone("sent", "Invoice sent", input.sentInvoiceCount > 0, "/workflow/revenue"),
      ];
      if (counts.clients === 0) recommendedAction = addClient;
      else if (counts.projects === 0) recommendedAction = createProject;
      else if (counts.invoices === 0) recommendedAction = createInvoice;
      else if (input.sentInvoiceCount === 0) recommendedAction = sendInvoice;
      secondaryCandidates = [createProject, createInvoice, addDeadline];
      break;
    case "understand_finances":
      milestones = [
        milestone("context", "Financial context", hasFinancialContext, "/workflow/revenue"),
        milestone("revenue", "Revenue data", counts.invoices > 0, "/workflow/revenue"),
        milestone("expenses", "Expense data", counts.expenses > 0, "/workflow/expenses"),
      ];
      if (!hasFinancialContext) {
        recommendedAction = input.unresolvedImportIssues > 0
          ? resolveImport
          : (input.activeImportJobCount || 0) > 0
            ? importWork
            : !hasImportedWork
              ? importWork
              : counts.clients > 0 || counts.projects > 0
                ? createInvoice
                : addExpense;
      }
      else if (counts.invoices === 0) recommendedAction = createInvoice;
      else if (counts.expenses === 0) recommendedAction = addExpense;
      secondaryCandidates = [addExpense, createInvoice, importWork];
      break;
    case "publish_portfolio":
      milestones = [
        milestone("profile", "Profile ready", input.profileReady, "/portfolio"),
        milestone("project", "Project selected", input.selectedPortfolioProject, "/portfolio"),
        milestone("published", "Portfolio published", input.publishedPortfolio, "/portfolio"),
      ];
      if (!input.profileReady) recommendedAction = completeProfile;
      else if (!input.selectedPortfolioProject) recommendedAction = selectProject;
      else if (!input.publishedPortfolio) recommendedAction = publishPortfolio;
      secondaryCandidates = [createProject, addClient];
      break;
    case "migrate":
      milestones = [
        milestone("import", "Work imported", hasImportedWork, importHref),
        milestone("resolved", "Records reviewed", hasImportedWork && input.unresolvedImportIssues === 0, reviewHref),
        milestone("workspace", "Workspace ready", hasMeaningfulContext, "/dashboard"),
      ];
      if (input.unresolvedImportIssues > 0) recommendedAction = resolveImport;
      else if (!hasImportedWork) recommendedAction = importWork;
      else if (!hasMeaningfulContext) recommendedAction = createProject;
      secondaryCandidates = [createProject, createInvoice];
      break;
    case "organize":
    default:
      milestones = [
        milestone("client", "First client", counts.clients > 0, "/workflow/clients"),
        milestone("project", "Active work", counts.projects > 0, "/workflow/projects"),
        milestone("deadline", "Deadline added", input.projectDeadlineCount > 0, "/workflow/projects"),
      ];
      if (counts.clients === 0) recommendedAction = addClient;
      else if (counts.projects === 0) recommendedAction = createProject;
      else if (input.projectDeadlineCount === 0) recommendedAction = addDeadline;
      secondaryCandidates = [connectCalendar, importWork, completeProfile];
      break;
  }

  const completed = milestones.filter((item) => item.complete).length;
  const total = milestones.length;
  const activationStage: ActivationStage = completed === total ? "activated" : goal === "migrate" && input.unresolvedImportIssues > 0 ? "review" : completed === 0 ? "start" : "build";
  const stageLabel = activationStage === "activated" ? "Ready to run" : activationStage === "review" ? "Review what came across" : activationStage === "start" ? "Start here" : "Build your next useful step";
  const automaticGuidanceStatus = guidanceCompleted ? "completed" : guidanceDismissed ? "dismissed" : "available";
  const next = milestones.find((item) => !item.complete) || null;
  return {
    goal,
    goalLabel: ACTIVATION_GOAL_META[goal].label,
    outcome: ACTIVATION_GOAL_META[goal].outcome,
    startingPath,
    activationStage,
    stageLabel,
    recommendedAction,
    secondaryActions: pickSecondaryActions(recommendedAction, secondaryCandidates),
    milestones,
    completed,
    total,
    percentage: total === 0 ? 100 : Math.round((completed / total) * 100),
    guidanceDismissed,
    guidanceCompleted,
    automaticGuidanceStatus,
    hasMeaningfulContext,
    unresolvedImportIssues: input.unresolvedImportIssues,
    calendarConnectionCount: input.calendarConnectionCount,
    guideProgress: input.guideProgress || {},
    counts,
    steps: milestones,
    next,
  };
}
