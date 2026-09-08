/**
 * Single source of truth for status chip tones and labels, shared by every
 * page that renders workflow state. Labels are the exact strings the pages
 * rendered before the Working Edition restyle.
 */

export type StatusKind = "project" | "invoice" | "contract" | "client" | "priority" | "expense";

export type StatusToneName = "success" | "warning" | "destructive" | "info" | "violet" | "muted" | "primary";

type ToneMap = Record<string, StatusToneName>;
type LabelMap = Record<string, string>;

const PROJECT_TONE: ToneMap = {
  active: "info",
  paused: "warning",
  completed: "success",
  archived: "muted",
  planning: "muted",
  in_progress: "info",
};

const PROJECT_LABEL: LabelMap = {
  active: "In progress",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
  planning: "Planning",
  in_progress: "In Progress",
};

const INVOICE_TONE: ToneMap = {
  draft: "muted",
  sent: "info",
  viewed: "info",
  partially_paid: "warning",
  paid: "success",
  overdue: "destructive",
  voided: "muted",
  cancelled: "muted",
};

const INVOICE_LABEL: LabelMap = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partly paid",
  paid: "Paid",
  overdue: "Overdue",
  voided: "Voided",
  cancelled: "Cancelled",
};

const CONTRACT_TONE: ToneMap = {
  draft: "muted",
  in_review: "warning",
  ready_to_sign: "info",
  starting: "info",
  signing: "info",
  executed: "success",
  declined: "destructive",
  expired: "warning",
  void: "destructive",
};

const CONTRACT_LABEL: LabelMap = {
  draft: "Draft",
  in_review: "In review",
  ready_to_sign: "Ready for acceptance",
  starting: "Preparing acceptance",
  signing: "Acceptance",
  executed: "Accepted",
  declined: "Changes requested",
  expired: "Expired",
  void: "Void",
};

const CLIENT_TONE: ToneMap = { active: "success", inactive: "muted" };
const CLIENT_LABEL: LabelMap = { active: "Active", inactive: "Inactive" };

const PRIORITY_TONE: ToneMap = { low: "info", medium: "muted", high: "warning", urgent: "destructive" };
const PRIORITY_LABEL: LabelMap = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

const EXPENSE_TONE: ToneMap = {
  software: "info",
  hardware: "violet",
  travel: "warning",
  meals: "warning",
  office: "muted",
  contractor: "success",
  other: "muted",
};

const EXPENSE_LABEL: LabelMap = {
  software: "Software",
  hardware: "Hardware",
  travel: "Travel",
  meals: "Meals",
  office: "Office",
  contractor: "Contractor",
  other: "Other",
};

const TONE_BY_KIND: Record<StatusKind, ToneMap> = {
  project: PROJECT_TONE,
  invoice: INVOICE_TONE,
  contract: CONTRACT_TONE,
  client: CLIENT_TONE,
  priority: PRIORITY_TONE,
  expense: EXPENSE_TONE,
};

const LABEL_BY_KIND: Record<StatusKind, LabelMap> = {
  project: PROJECT_LABEL,
  invoice: INVOICE_LABEL,
  contract: CONTRACT_LABEL,
  client: CLIENT_LABEL,
  priority: PRIORITY_LABEL,
  expense: EXPENSE_LABEL,
};

/** Chip tone for a status value. Unknown values fall back to muted. */
export function statusTone(kind: StatusKind, value: string): StatusToneName {
  return TONE_BY_KIND[kind]?.[value] ?? "muted";
}

/** Exact chip label for a status value. Unknown invoice/contract values are de-slugged, others pass through. */
export function statusLabel(kind: StatusKind, value: string): string {
  const known = LABEL_BY_KIND[kind]?.[value];
  if (known) return known;
  if (kind === "invoice" || kind === "contract") return value.replaceAll("_", " ");
  return value;
}
