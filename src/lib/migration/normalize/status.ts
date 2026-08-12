/**
 * Status and category dictionaries.
 *
 * Source systems each have their own vocabulary. These tables map the ones with
 * clear semantic equivalence onto Rive's canonical values, and deliberately
 * stop there: a value that is not clearly equivalent comes back unresolved with
 * the canonical options attached, so the user decides instead of the engine.
 *
 * The dictionaries are data, not code, so extending them is a one-line change
 * with a matching test.
 */

import {
  CLIENT_STATUSES,
  EXPENSE_CATEGORIES,
  INVOICE_STATUSES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "../../domain-vocabulary.ts";
import {
  stringSimilarity,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "../fuzzy.ts";

export type EnumDomain =
  | "invoiceStatus"
  | "projectStatus"
  | "projectPriority"
  | "clientStatus"
  | "expenseCategory";

export type EnumResolution = {
  value: string | null;
  confidence: number;
  /** How the match was made, for the explanation shown to the user. */
  matched: "exact" | "alias" | "fuzzy" | "none";
  reason: string;
  /** Canonical options offered when the value could not be resolved. */
  options: string[];
};

const INVOICE_ALIASES: Record<string, string> = {
  // paid
  paid: "paid", settled: "paid", received: "paid", "paid in full": "paid", "payment received": "paid",
  cleared: "paid", complete: "paid", completed: "paid", closed: "paid", "fully paid": "paid",
  // sent / awaiting payment
  sent: "sent", issued: "sent", open: "sent", outstanding: "sent", unpaid: "sent",
  "awaiting payment": "sent", pending: "sent", submitted: "sent", due: "sent", posted: "sent",
  // overdue
  overdue: "overdue", "past due": "overdue", late: "overdue", delinquent: "overdue", expired: "overdue",
  // draft
  draft: "draft", new: "draft", created: "draft", unsent: "draft", "not sent": "draft",
  // cancelled
  cancelled: "cancelled", canceled: "cancelled", void: "cancelled", voided: "cancelled",
  "written off": "cancelled", "write off": "cancelled", rejected: "cancelled",
  // viewed
  viewed: "viewed", seen: "viewed", opened: "viewed",
};

const PROJECT_STATUS_ALIASES: Record<string, string> = {
  active: "active", "in progress": "active", ongoing: "active", started: "active", wip: "active",
  open: "active", current: "active", running: "active", live: "active",
  paused: "paused", "on hold": "paused", hold: "paused", blocked: "paused", stalled: "paused", suspended: "paused",
  completed: "completed", complete: "completed", done: "completed", finished: "completed",
  delivered: "completed", closed: "completed", shipped: "completed",
  archived: "archived", cancelled: "archived", canceled: "archived", dropped: "archived",
  abandoned: "archived", inactive: "archived",
};

const PROJECT_PRIORITY_ALIASES: Record<string, string> = {
  low: "low", minor: "low", p3: "low", "3": "low", normal: "medium",
  medium: "medium", standard: "medium", p2: "medium", "2": "medium", moderate: "medium",
  high: "high", major: "high", p1: "high", "1": "high", important: "high",
  urgent: "urgent", critical: "urgent", p0: "urgent", "0": "urgent", blocker: "urgent", immediate: "urgent",
};

const CLIENT_STATUS_ALIASES: Record<string, string> = {
  active: "active", current: "active", live: "active", engaged: "active", ongoing: "active",
  inactive: "inactive", archived: "inactive", churned: "inactive", former: "inactive",
  closed: "inactive", lapsed: "inactive", dormant: "inactive", past: "inactive",
};

const EXPENSE_CATEGORY_ALIASES: Record<string, string> = {
  software: "software", saas: "software", subscription: "software", subscriptions: "software",
  tools: "software", apps: "software", licences: "software", licenses: "software",
  hardware: "hardware", equipment: "hardware", devices: "hardware", computer: "hardware", gear: "hardware",
  travel: "travel", transport: "travel", transportation: "travel", flight: "travel", flights: "travel",
  taxi: "travel", hotel: "travel", accommodation: "travel", mileage: "travel", fuel: "travel",
  meals: "meals", meal: "meals", food: "meals", dining: "meals", restaurant: "meals", entertainment: "meals",
  office: "office", rent: "office", utilities: "office", supplies: "office", stationery: "office",
  internet: "office", phone: "office", telephone: "office", "office supplies": "office",
  contractor: "contractor", contractors: "contractor", freelancer: "contractor", subcontractor: "contractor",
  outsourcing: "contractor", labour: "contractor", labor: "contractor", wages: "contractor",
  other: "other", misc: "other", miscellaneous: "other", general: "other", uncategorised: "other",
  uncategorized: "other", "": "other",
};

const DOMAINS: Record<EnumDomain, { canonical: readonly string[]; aliases: Record<string, string>; label: string }> = {
  invoiceStatus: { canonical: INVOICE_STATUSES, aliases: INVOICE_ALIASES, label: "invoice status" },
  projectStatus: { canonical: PROJECT_STATUSES, aliases: PROJECT_STATUS_ALIASES, label: "project status" },
  projectPriority: { canonical: PROJECT_PRIORITIES, aliases: PROJECT_PRIORITY_ALIASES, label: "priority" },
  clientStatus: { canonical: CLIENT_STATUSES, aliases: CLIENT_STATUS_ALIASES, label: "client status" },
  expenseCategory: { canonical: EXPENSE_CATEGORIES, aliases: EXPENSE_CATEGORY_ALIASES, label: "expense category" },
};

/** Lowercase and collapse separators so `On-Hold`, `on hold`, `ON_HOLD` agree. */
function key(value: string): string {
  return value.toLowerCase().trim().replace(/[_\-/]+/g, " ").replace(/\s+/g, " ");
}

export function resolveEnum(domain: EnumDomain, rawValue: string): EnumResolution {
  const { canonical, aliases, label } = DOMAINS[domain];
  const options = [...canonical];
  const normalized = key(rawValue);

  if (!normalized) {
    return { value: null, confidence: 0, matched: "none", reason: `No ${label} was provided.`, options };
  }

  const asCanonical = normalized.replace(/\s+/g, "_");
  if (canonical.includes(asCanonical)) {
    return { value: asCanonical, confidence: 1, matched: "exact", reason: `"${rawValue}" is already a Rive ${label}.`, options };
  }

  const alias = aliases[normalized];
  if (alias) {
    return {
      value: alias,
      confidence: 0.95,
      matched: "alias",
      reason: `"${rawValue}" means ${alias} in Rive.`,
      options,
    };
  }

  // A near-miss on spelling is safe to accept; a near-miss in meaning is not,
  // so the bar is deliberately high and only spelling-level distance passes.
  let bestValue: string | null = null;
  let bestScore = 0;
  for (const [aliasKey, target] of Object.entries(aliases)) {
    if (!aliasKey) continue;
    const score = stringSimilarity(normalized, aliasKey);
    if (score > bestScore) {
      bestScore = score;
      bestValue = target;
    }
  }
  if (bestValue && bestScore >= 0.9) {
    return {
      value: bestValue,
      confidence: 0.8,
      matched: "fuzzy",
      reason: `"${rawValue}" looks like ${bestValue}.`,
      options,
    };
  }

  return {
    value: null,
    confidence: 0,
    matched: "none",
    reason: `"${rawValue}" is not a ${label} Rive recognises.`,
    options,
  };
}

/** Suggestions offered in the review UI, best guess first. */
export function enumSuggestions(domain: EnumDomain, rawValue: string): Array<{ label: string; value: string }> {
  const { canonical, aliases } = DOMAINS[domain];
  const normalized = key(rawValue);
  const scored = [...canonical]
    .map((option) => {
      let best = stringSimilarity(normalized, option);
      for (const [aliasKey, target] of Object.entries(aliases)) {
        if (target !== option || !aliasKey) continue;
        best = Math.max(best, stringSimilarity(normalized, aliasKey));
      }
      return { option, score: best };
    })
    .sort((a, b) => b.score - a.score);
  return scored.map((item) => ({ label: humanize(item.option), value: item.option }));
}

function humanize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export const STATUS_DICTIONARIES = DOMAINS;
