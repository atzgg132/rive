import type { ActivationGoal } from "@/lib/activation";

export type GuideId =
  | "getting_started"
  | "orientation"
  | "calendar"
  | ActivationGoal;

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

/**
 * The shared guide catalogue is intentionally organized around outcomes, not
 * navigation labels. The dashboard and the public Guides page both consume
 * this copy so the promise made before signup is the promise kept in-product.
 */
export const GUIDE_CATALOG: readonly GuideCatalogItem[] = [
  {
    id: "getting_started",
    label: "Start with one client job",
    description: "Create one real client workflow and see what Rive carries forward for you.",
    outcome: "Client → work → deadline in one connected flow.",
    duration: "3 min",
    stepCount: 3,
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

export function getGuideCatalogItem(id: GuideId): GuideCatalogItem {
  return GUIDE_CATALOG.find((item) => item.id === id) || GUIDE_CATALOG[0];
}

export function getGuideGoal(id: GuideId, current: ActivationGoal | null | undefined): ActivationGoal {
  const guide = getGuideCatalogItem(id);
  return guide.goal || current || "organize";
}
