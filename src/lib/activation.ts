export const ACTIVATION_GOALS = [
  "organize",
  "get_paid",
  "understand_finances",
  "publish_portfolio",
  "migrate",
] as const;

export type ActivationGoal = (typeof ACTIVATION_GOALS)[number];

export const ACTIVATION_STARTING_PATHS = [
  "import",
  "quickstart",
  "clean",
  "skipped",
] as const;

export type ActivationStartingPath = (typeof ACTIVATION_STARTING_PATHS)[number];
export type ActivationStage = "start" | "build" | "review" | "activated";
export type ActivationGuidanceStatus = "available" | "dismissed" | "completed";

export type ActivationAction = {
  id: string;
  label: string;
  description: string;
  href: string;
};

export type ActivationMilestone = {
  id: string;
  label: string;
  complete: boolean;
  href: string;
};

export type ActivationPlan = {
  goal: ActivationGoal;
  goalLabel: string;
  outcome: string;
  startingPath: ActivationStartingPath | null;
  activationStage: ActivationStage;
  stageLabel: string;
  recommendedAction: ActivationAction | null;
  secondaryActions: ActivationAction[];
  milestones: ActivationMilestone[];
  completed: number;
  total: number;
  percentage: number;
  guidanceDismissed: boolean;
  guidanceCompleted: boolean;
  automaticGuidanceStatus: ActivationGuidanceStatus;
  hasMeaningfulContext: boolean;
  unresolvedImportIssues: number;
  counts: {
    clients: number;
    projects: number;
    invoices: number;
    expenses: number;
  };
  // Kept for existing dashboard consumers while the new plan rolls out.
  steps: ActivationMilestone[];
  next: ActivationMilestone | null;
};

export const ACTIVATION_GOAL_META: Record<ActivationGoal, { label: string; outcome: string }> = {
  organize: {
    label: "Organize client work",
    outcome: "Keep client work, deadlines, and delivery in one place.",
  },
  get_paid: {
    label: "Get paid faster",
    outcome: "Move from active work to a clear, sendable invoice.",
  },
  understand_finances: {
    label: "Understand my numbers",
    outcome: "Build enough financial context to see what is happening.",
  },
  publish_portfolio: {
    label: "Publish proof of work",
    outcome: "Turn your profile and real projects into public proof.",
  },
  migrate: {
    label: "Move from another tool",
    outcome: "Bring your existing work across with a reviewable safety net.",
  },
};

export const ACTIVATION_GOAL_NAV_PATHS: Record<ActivationGoal, string[]> = {
  organize: ["/workflow/clients", "/workflow/projects", "/calendar"],
  get_paid: ["/workflow/clients", "/workflow/projects", "/workflow/revenue"],
  understand_finances: ["/workflow/revenue", "/workflow/expenses", "/calendar"],
  publish_portfolio: ["/portfolio", "/workflow/projects", "/workflow/clients"],
  migrate: ["/onboarding?restart=1&focus=import", "/workflow/projects", "/workflow/revenue"],
};

export function normalizeActivationGoal(value: unknown): ActivationGoal {
  return typeof value === "string" && (ACTIVATION_GOALS as readonly string[]).includes(value)
    ? value as ActivationGoal
    : "organize";
}

export function normalizeStartingPath(value: unknown): ActivationStartingPath | null {
  return typeof value === "string" && (ACTIVATION_STARTING_PATHS as readonly string[]).includes(value)
    ? value as ActivationStartingPath
    : null;
}

export function getActivationGoalLabel(goal: unknown): string {
  return ACTIVATION_GOAL_META[normalizeActivationGoal(goal)].label;
}
