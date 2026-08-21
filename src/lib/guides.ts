import type {
  ActivationGoal,
  ActivationPlan,
  GuideProgress,
  GuideProgressMap,
} from "@/lib/activation";

export type GuideId =
  | "getting_started"
  | "orientation"
  | "calendar"
  | ActivationGoal;

export type GuideStepKind = "action" | "explanation";

/**
 * A guide step is a promise to the user, not just a piece of copy. It names
 * the fact that proves the step is done and the safe route to use when the
 * current page cannot show the action.
 */
export type GuideStep = {
  id: string;
  label: string;
  description: string;
  kind?: GuideStepKind;
  activationMilestoneId?: string;
  fact?: "calendar_connection";
  actionIds: readonly string[];
  fallbackHref: string;
  fallbackLabel: string;
  fallbackDescription: string;
  optional?: boolean;
};

export type GuideCatalogItem = {
  id: GuideId;
  label: string;
  description: string;
  outcome: string;
  duration: string;
  stepCount: number;
  goal?: ActivationGoal;
  flow: string[];
};

export type GuideDefinition = GuideCatalogItem & {
  steps: readonly GuideStep[];
};

export type GuideStatus = "not_started" | "in_progress" | "completed" | "needs_attention";

export type GuideSnapshot = {
  status: GuideStatus;
  completedStepIds: string[];
  currentStep: GuideStep | null;
  total: number;
  completed: number;
  percentage: number;
};

/**
 * The shared guide catalogue is organized around real outcomes. The detailed
 * step definitions below are the engine contract used by Help & Guides and
 * the adaptive dock, so a copy change cannot silently create a step with no
 * route or completion proof.
 */
export const GUIDE_CATALOG: readonly GuideCatalogItem[] = [
  {
    id: "getting_started",
    label: "Start with one client job",
    description: "Create one real client workflow and see what Rive carries forward for you.",
    outcome: "Client → work → deadline in one connected flow.",
    duration: "3 min",
    stepCount: 3,
    goal: "organize",
    flow: ["Client", "Work", "Deadline"],
  },
  {
    id: "orientation",
    label: "Understand how Rive connects",
    description: "See how client work flows into money, calendar, and proof.",
    outcome: "A quick map of the work around the work, without a tour of every screen.",
    duration: "1 min",
    stepCount: 1,
    flow: ["Client", "Work", "Money", "Proof"],
  },
  {
    id: "organize",
    label: "Organize a client job",
    description: "Connect the relationship, active work, deadlines, and delivery context.",
    outcome: "A project you can run without copying the same context between tools.",
    duration: "3 min",
    stepCount: 3,
    goal: "organize",
    flow: ["Client", "Project", "Calendar"],
  },
  {
    id: "calendar",
    label: "Make deadlines visible",
    description: "Put project deadlines and scheduled work on one useful timeline.",
    outcome: "Know what needs attention next without maintaining another list.",
    duration: "2 min",
    stepCount: 2,
    goal: "organize",
    flow: ["Project", "Deadline", "Calendar"],
  },
  {
    id: "get_paid",
    label: "Get paid for active work",
    description: "Move from a real project to a clear, sendable invoice.",
    outcome: "Client → project → invoice, with collection context attached.",
    duration: "4 min",
    stepCount: 4,
    goal: "get_paid",
    flow: ["Client", "Work", "Invoice", "Payment"],
  },
  {
    id: "understand_finances",
    label: "Understand your numbers",
    description: "Bring revenue and costs together without inventing financial data.",
    outcome: "A financial picture you can trust because it comes from your work.",
    duration: "4 min",
    stepCount: 3,
    goal: "understand_finances",
    flow: ["Revenue", "Expenses", "Profit"],
  },
  {
    id: "publish_portfolio",
    label: "Turn work into proof",
    description: "Choose real work and turn it into a portfolio that can win the next client.",
    outcome: "Completed work becomes public proof instead of disappearing into an archive.",
    duration: "4 min",
    stepCount: 3,
    goal: "publish_portfolio",
    flow: ["Profile", "Project", "Portfolio"],
  },
  {
    id: "migrate",
    label: "Bring existing work across",
    description: "Import, preview, and review your records before relying on the totals.",
    outcome: "Your existing business arrives with a reviewable safety net.",
    duration: "5 min",
    stepCount: 3,
    goal: "migrate",
    flow: ["Import", "Review", "Workspace"],
  },
];

const CLIENT_STEP: GuideStep = {
  id: "client",
  label: "Add your first client",
  description: "Start with someone you are actively working with so the rest of the workflow has context.",
  activationMilestoneId: "client",
  actionIds: ["first_client"],
  fallbackHref: "/workflow/clients?new=true",
  fallbackLabel: "Add a client",
  fallbackDescription: "Keep the relationship connected to the work that follows.",
};

const PROJECT_STEP: GuideStep = {
  id: "project",
  label: "Create your first project",
  description: "Give the client one piece of work to run, with a place for deadlines and money to attach.",
  activationMilestoneId: "project",
  actionIds: ["first_project"],
  fallbackHref: "/workflow/projects?new=true",
  fallbackLabel: "Create a project",
  fallbackDescription: "Give active work a client, deadline, and financial context.",
};

const DEADLINE_STEP: GuideStep = {
  id: "deadline",
  label: "Add a project deadline",
  description: "Put the next meaningful delivery date on the project so Rive can carry it into Calendar.",
  activationMilestoneId: "deadline",
  actionIds: ["add_deadline"],
  fallbackHref: "/workflow/projects",
  fallbackLabel: "Add a deadline",
  fallbackDescription: "Deadlines flow into Calendar and your next-action view.",
};

const GUIDE_STEPS: Record<GuideId, readonly GuideStep[]> = {
  getting_started: [CLIENT_STEP, PROJECT_STEP, DEADLINE_STEP],
  orientation: [{
    id: "connected_story",
    label: "See the connected story",
    description: "Client context follows the work into deadlines, money, and proof. Nothing is marked complete until you choose to finish this short explanation.",
    kind: "explanation",
    actionIds: [],
    fallbackHref: "/dashboard",
    fallbackLabel: "Return to the dashboard",
    fallbackDescription: "Start with a real workspace outcome whenever you are ready.",
  }],
  organize: [CLIENT_STEP, PROJECT_STEP, DEADLINE_STEP],
  calendar: [
    {
      ...DEADLINE_STEP,
      id: "calendar_deadline",
      actionIds: ["add_deadline", "first_project", "first_client"],
      fallbackHref: "/workflow/projects",
      fallbackLabel: "Open projects",
      fallbackDescription: "Create the project first if there is no work to put on the timeline yet.",
    },
    {
      id: "calendar_connection",
      label: "Connect the calendar you use",
      description: "Keep Rive deadlines visible alongside the calendar where you plan your week.",
      fact: "calendar_connection",
      actionIds: ["connect_calendar"],
      fallbackHref: "/calendar",
      fallbackLabel: "Open calendar connections",
      fallbackDescription: "Choose a calendar feed or connect Google when it is available.",
    },
  ],
  get_paid: [
    { ...CLIENT_STEP, label: "Add the client for this work" },
    { ...PROJECT_STEP, label: "Create the work you are being paid for" },
    {
      id: "invoice",
      label: "Create the invoice",
      description: "Reuse the client, project, and currency you already entered.",
      activationMilestoneId: "invoice",
      actionIds: ["create_invoice"],
      fallbackHref: "/workflow/invoices/new",
      fallbackLabel: "Create an invoice",
      fallbackDescription: "Turn the active work into a clear invoice.",
    },
    {
      id: "sent",
      label: "Review and send it",
      description: "A sent invoice is the first step toward getting paid and tracking what is outstanding.",
      activationMilestoneId: "sent",
      actionIds: ["send_invoice"],
      fallbackHref: "/workflow/revenue",
      fallbackLabel: "Review invoices",
      fallbackDescription: "Open an eligible draft and send it when it is ready.",
    },
  ],
  understand_finances: [
    {
      id: "context",
      label: "Bring in one source of financial context",
      description: "Import existing records or create the first invoice or expense; Rive never invents a number for you.",
      activationMilestoneId: "context",
      actionIds: ["import_work", "resolve_import", "create_invoice", "add_expense"],
      fallbackHref: "/migrate",
      fallbackLabel: "Import existing work",
      fallbackDescription: "Bring CSV or XLSX exports into the workspace when that is the fastest honest start.",
    },
    {
      id: "revenue",
      label: "Make revenue visible",
      description: "Keep at least one real invoice in the financial picture so totals have a source.",
      activationMilestoneId: "revenue",
      actionIds: ["create_invoice"],
      fallbackHref: "/workflow/invoices/new",
      fallbackLabel: "Create an invoice",
      fallbackDescription: "Capture the work you have already delivered or billed.",
    },
    {
      id: "expenses",
      label: "Add the costs that matter",
      description: "Log a real project-linked expense so you can see what the work actually costs.",
      activationMilestoneId: "expenses",
      actionIds: ["add_expense"],
      fallbackHref: "/workflow/expenses?new=true",
      fallbackLabel: "Log an expense",
      fallbackDescription: "Add one cost you want included in the picture.",
    },
  ],
  publish_portfolio: [
    {
      id: "profile",
      label: "Make the profile yours",
      description: "Add enough context for a visitor to understand what you do and who you help.",
      activationMilestoneId: "profile",
      actionIds: ["complete_profile"],
      fallbackHref: "/portfolio",
      fallbackLabel: "Complete your profile",
      fallbackDescription: "Your profile is the foundation for public proof of work.",
    },
    {
      id: "project",
      label: "Choose the work to show",
      description: "Select real work that helps a prospective client understand your value.",
      activationMilestoneId: "project",
      actionIds: ["select_project"],
      fallbackHref: "/portfolio",
      fallbackLabel: "Choose a project",
      fallbackDescription: "Select real work for the portfolio draft.",
    },
    {
      id: "published",
      label: "Publish the proof",
      description: "Make the work you prepared available to the people you want to reach.",
      activationMilestoneId: "published",
      actionIds: ["publish_portfolio"],
      fallbackHref: "/portfolio",
      fallbackLabel: "Publish your portfolio",
      fallbackDescription: "Turn the draft into a public, shareable proof of work.",
    },
  ],
  migrate: [
    {
      id: "import",
      label: "Upload the work you already have",
      description: "Bring CSV or XLSX exports into the workspace. This is available any time after onboarding.",
      activationMilestoneId: "import",
      actionIds: ["import_work", "resolve_import"],
      fallbackHref: "/migrate",
      fallbackLabel: "Open import",
      fallbackDescription: "Choose files and see what Rive understands before anything is written.",
    },
    {
      id: "resolved",
      label: "Answer the questions Rive cannot safely guess",
      description: "Review ambiguous relationships or mappings once, then keep the decision with this import session.",
      activationMilestoneId: "resolved",
      actionIds: ["resolve_import"],
      fallbackHref: "/migrate",
      fallbackLabel: "Review this import",
      fallbackDescription: "Pick up the unfinished import instead of starting onboarding again.",
    },
    {
      id: "workspace",
      label: "Use the connected workspace",
      description: "Once the import is reviewed, continue from the dashboard with clients, work, money, and proof in place.",
      activationMilestoneId: "workspace",
      actionIds: ["first_client", "first_project", "create_invoice", "create_project"],
      fallbackHref: "/dashboard",
      fallbackLabel: "Open the workspace",
      fallbackDescription: "Your imported context stays available while you run the business.",
    },
  ],
};

export function isGuideId(value: unknown): value is GuideId {
  return typeof value === "string" && GUIDE_CATALOG.some((item) => item.id === value);
}

export function getGuideCatalogItem(id: GuideId): GuideCatalogItem {
  return GUIDE_CATALOG.find((item) => item.id === id) || GUIDE_CATALOG[0];
}

export function getGuideDefinition(id: GuideId): GuideDefinition {
  const item = getGuideCatalogItem(id);
  return { ...item, steps: GUIDE_STEPS[id] };
}

export function getGuideStep(id: GuideId, stepId: string | null | undefined): GuideStep | null {
  if (!stepId) return null;
  return getGuideDefinition(id).steps.find((step) => step.id === stepId) || null;
}

export function getGuideGoal(id: GuideId, current: ActivationGoal | null | undefined): ActivationGoal {
  const guide = getGuideCatalogItem(id);
  return guide.goal || current || "organize";
}

export function emptyGuideProgress(): GuideProgress {
  return { status: "not_started", currentStepId: null, completedStepIds: [], runCount: 0 };
}

/** Validate the JSON stored in onboardingData before it reaches the client. */
export function normalizeGuideProgress(value: unknown): GuideProgressMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: GuideProgressMap = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isGuideId(id) || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const input = raw as Record<string, unknown>;
    const definition = getGuideDefinition(id);
    const validStepIds = new Set(definition.steps.map((step) => step.id));
    const completedStepIds = Array.isArray(input.completedStepIds)
      ? Array.from(new Set(input.completedStepIds.filter((stepId): stepId is string => typeof stepId === "string" && validStepIds.has(stepId))))
      : [];
    const currentStepId = typeof input.currentStepId === "string" && validStepIds.has(input.currentStepId) ? input.currentStepId : null;
    const status = input.status === "completed" || input.status === "in_progress" ? input.status : "not_started";
    const record: GuideProgress = {
      status,
      currentStepId,
      completedStepIds,
      runCount: typeof input.runCount === "number" && Number.isFinite(input.runCount) ? Math.max(0, Math.floor(input.runCount)) : 0,
    };
    if (typeof input.lastSeenAt === "string") record.lastSeenAt = input.lastSeenAt.slice(0, 40);
    if (typeof input.completedAt === "string") record.completedAt = input.completedAt.slice(0, 40);
    result[id] = record;
  }
  return result;
}

function isStepComplete(step: GuideStep, plan: ActivationPlan | null, progress: GuideProgress): boolean {
  if (step.kind === "explanation") return progress.completedStepIds.includes(step.id) || progress.status === "completed";
  // Help & Guides can show a previously completed guide before its goal plan
  // has been loaded. Preserve the user's completed state in that moment; a
  // live plan, when available, still wins and can correctly surface
  // `needs_attention` if the workspace changed later.
  if (!plan) return progress.completedStepIds.includes(step.id) || progress.status === "completed";
  if (step.fact === "calendar_connection") return Boolean(plan?.calendarConnectionCount);
  if (step.activationMilestoneId) return Boolean(plan?.milestones.some((milestone) => milestone.id === step.activationMilestoneId && milestone.complete));
  return progress.completedStepIds.includes(step.id);
}

/**
 * Resolve a guide against current workspace facts. Completion is never inferred
 * from the activation stage alone; each required step must be true.
 */
export function snapshotGuide(
  id: GuideId,
  plan: ActivationPlan | null,
  stored?: GuideProgress | null,
): GuideSnapshot {
  const definition = getGuideDefinition(id);
  const progress = stored || emptyGuideProgress();
  const requiredSteps = definition.steps.filter((step) => !step.optional);
  const completedStepIds = definition.steps.filter((step) => isStepComplete(step, plan, progress)).map((step) => step.id);
  const currentStep = requiredSteps.find((step) => !completedStepIds.includes(step.id)) || null;
  const completed = completedStepIds.filter((stepId) => requiredSteps.some((step) => step.id === stepId)).length;
  const total = requiredSteps.length;
  const allComplete = completed === total;
  const status: GuideStatus = allComplete
    ? "completed"
    : progress.status === "completed"
      ? "needs_attention"
      : completed > 0 || progress.status === "in_progress"
        ? "in_progress"
        : "not_started";
  return {
    status,
    completedStepIds,
    currentStep,
    total,
    completed,
    percentage: total ? Math.round((completed / total) * 100) : 100,
  };
}
