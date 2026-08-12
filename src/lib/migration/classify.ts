/**
 * Entity classification: deciding what a file or sheet actually contains.
 *
 * Three independent signals are combined — the source's name, how
 * discriminating its headers are, and whether specific column *combinations*
 * are present. The combination signal carries the most weight because it is the
 * only one that survives vague headers: `invoice_no + total + due_date` is an
 * invoice sheet whatever the file is called.
 *
 * A low-confidence source is never silently classified. It comes back as
 * `unknown` and the user is asked.
 */

import {
  CLASSIFICATION_THRESHOLDS,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./config.ts";
import {
  CANONICAL_FIELDS,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./fields.ts";
import {
  headerSimilarity,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./fuzzy.ts";
import {
  MIGRATION_ENTITIES,
  confidenceBand,
  type ClassificationResult,
  type MigrationEntity,
  type SourceClassification,
  type SourceProfile,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./types.ts";
import {
  normalizeHeader,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./parse/table.ts";

/** Words in a filename or sheet name that point at one entity. */
const NAME_HINTS: Record<MigrationEntity, string[]> = {
  clients: ["client", "customer", "contact", "account", "company", "party", "buyer"],
  projects: ["project", "job", "engagement", "work", "assignment", "matter", "campaign"],
  invoices: ["invoice", "bill", "revenue", "sales", "receivable", "income", "billing"],
  expenses: ["expense", "spend", "cost", "purchase", "payable", "bill_pay", "outgoing", "transaction"],
};

/**
 * Column combinations that identify an entity on their own.
 *
 * Each rule lists groups of alternatives; the rule fires only when every group
 * is satisfied. Weight reflects how conclusive the combination is.
 */
type SignatureRule = { groups: string[][]; weight: number; label: string };

const SIGNATURES: Record<MigrationEntity, SignatureRule[]> = {
  invoices: [
    {
      groups: [["invoice_number", "invoice_no", "invoice_id", "bill_no", "bill_number", "inv_no"], ["total", "amount", "invoice_total", "grand_total", "amount_due", "balance", "bill_total"]],
      weight: 1,
      label: "an invoice number alongside an amount",
    },
    {
      groups: [["invoice_number", "invoice_no", "bill_no", "inv_no"], ["due_date", "payment_due", "issue_date", "invoice_date"]],
      weight: 0.95,
      label: "an invoice number alongside invoice dates",
    },
    {
      groups: [["due_date", "payment_due"], ["total", "amount", "amount_due", "balance"], ["client", "customer", "client_name", "customer_name", "bill_to"]],
      weight: 0.8,
      label: "a customer, an amount, and a due date",
    },
    { groups: [["paid_date", "payment_date", "paid_on"], ["total", "amount"]], weight: 0.7, label: "payment dates against amounts" },
  ],
  expenses: [
    {
      groups: [["merchant", "vendor", "payee", "supplier", "merchant_name", "vendor_name"], ["amount", "total", "cost", "debit", "spend"]],
      weight: 1,
      label: "a merchant or vendor alongside an amount",
    },
    {
      groups: [["expense_date", "transaction_date", "txn_date", "spent_on", "posted_date"], ["amount", "total", "cost", "debit"]],
      weight: 0.95,
      label: "an expense date alongside an amount",
    },
    {
      groups: [["category", "expense_category", "expense_type"], ["amount", "total", "cost", "debit"]],
      weight: 0.82,
      label: "an expense category alongside an amount",
    },
    { groups: [["receipt", "receipt_url", "receipt_link"]], weight: 0.6, label: "a receipt column" },
    { groups: [["billable", "is_billable", "reimbursed", "is_reimbursed"], ["amount", "total", "cost"]], weight: 0.7, label: "billable or reimbursed flags on amounts" },
  ],
  projects: [
    {
      groups: [["project_name", "project_title", "project", "job_name"], ["deadline", "due_date", "end_date", "start_date", "budget", "status", "client", "client_name", "customer"]],
      weight: 1,
      label: "a project name alongside project dates or a client",
    },
    { groups: [["budget", "project_value", "contract_value"], ["client", "client_name", "customer", "title", "name"]], weight: 0.78, label: "a budget against a client" },
    { groups: [["milestone", "deliverable", "scope"]], weight: 0.6, label: "delivery columns" },
  ],
  clients: [
    {
      groups: [["client_name", "customer_name", "company_name", "account_name", "name", "client", "customer", "company"], ["email", "client_email", "customer_email", "email_address", "contact_email"]],
      weight: 1,
      label: "a client name alongside an email address",
    },
    {
      groups: [["client_name", "customer_name", "company_name", "name", "company"], ["phone", "mobile", "telephone", "contact_number", "address", "billing_address", "website"]],
      weight: 0.88,
      label: "a client name alongside contact details",
    },
  ],
};

/**
 * Headers that, when present, argue *against* an entity.
 *
 * A contacts-style sheet that also carries an invoice number is not a client
 * list; without this, alias overlap on `customer` makes every invoice export
 * look partly like a client export.
 */
const NEGATIVE_SIGNALS: Record<MigrationEntity, string[]> = {
  clients: ["invoice_number", "invoice_no", "bill_no", "amount", "total", "due_date", "expense_date", "budget", "paid_date", "merchant", "vendor"],
  projects: ["invoice_number", "invoice_no", "expense_date", "merchant", "vendor", "receipt", "paid_date"],
  invoices: ["merchant", "vendor", "receipt", "expense_date", "expense_category"],
  expenses: ["invoice_number", "invoice_no", "bill_no", "due_date", "tax_rate", "subtotal"],
};

function matchesAny(headers: ReadonlySet<string>, alternatives: readonly string[]): boolean {
  return alternatives.some((alternative) => headers.has(alternative));
}

/** Alias-expansion threshold. Tight enough that `date` never becomes `due_date`. */
const ALIAS_EXPANSION_THRESHOLD = 0.88;

/**
 * Expand the header set with the canonical aliases each header closely matches.
 *
 * Signature rules compare against canonical names, but real exports write
 * "Customer E-mail" and "Bill #". Without this, a sheet would fail every
 * combination rule purely because of punctuation, and fall through to
 * `unknown`. Expansion keeps signatures evidence-based while tolerating the way
 * humans actually name columns.
 */
function expandHeaders(headers: readonly string[]): Set<string> {
  const expanded = new Set(headers);
  for (const header of headers) {
    for (const field of CANONICAL_FIELDS) {
      for (const alias of field.aliases) {
        if (expanded.has(alias)) continue;
        if (headerSimilarity(header, alias) >= ALIAS_EXPANSION_THRESHOLD) expanded.add(alias);
      }
    }
  }
  return expanded;
}

/** Score how strongly the file or sheet name points at an entity. */
function scoreName(fileName: string, sheetName: string | null): Map<MigrationEntity, number> {
  const scores = new Map<MigrationEntity, number>();
  // The sheet name is the more specific statement when both exist.
  const haystack = `${sheetName || ""} ${fileName}`.toLowerCase();
  for (const entity of MIGRATION_ENTITIES) {
    let best = 0;
    for (const hint of NAME_HINTS[entity]) {
      if (haystack.includes(hint)) best = Math.max(best, sheetName?.toLowerCase().includes(hint) ? 1 : 0.85);
    }
    scores.set(entity, best);
  }
  return scores;
}

/**
 * Score headers by how *discriminating* they are.
 *
 * A header matching four entities (`amount`, `name`, `status`) tells us almost
 * nothing, so its contribution is divided across them. A header matching one
 * entity (`invoice_number`, `merchant`) counts fully.
 */
function scoreHeaders(headers: readonly string[]): Map<MigrationEntity, number> {
  const totals = new Map<MigrationEntity, number>(MIGRATION_ENTITIES.map((entity) => [entity, 0]));
  if (!headers.length) return totals;

  for (const header of headers) {
    const matched = new Map<MigrationEntity, number>();
    for (const field of CANONICAL_FIELDS) {
      let best = 0;
      for (const alias of field.aliases) {
        const score = headerSimilarity(header, alias);
        if (score > best) best = score;
        if (best === 1) break;
      }
      if (best >= 0.9) matched.set(field.entity, Math.max(matched.get(field.entity) || 0, best));
    }
    if (!matched.size) continue;
    const share = 1 / matched.size;
    for (const [entity, strength] of matched) {
      totals.set(entity, (totals.get(entity) || 0) + strength * share);
    }
  }

  // Normalize against how many headers could have contributed, so a wide sheet
  // does not automatically outscore a narrow one.
  const denominator = Math.max(headers.length, 1);
  for (const entity of MIGRATION_ENTITIES) {
    totals.set(entity, Math.min(1, (totals.get(entity) || 0) / denominator * 2.2));
  }
  return totals;
}

function scoreSignatures(headers: ReadonlySet<string>): Map<MigrationEntity, { score: number; labels: string[] }> {
  const results = new Map<MigrationEntity, { score: number; labels: string[] }>();
  for (const entity of MIGRATION_ENTITIES) {
    let best = 0;
    const labels: string[] = [];
    for (const rule of SIGNATURES[entity]) {
      if (rule.groups.every((group) => matchesAny(headers, group))) {
        if (rule.weight > best) best = rule.weight;
        labels.push(rule.label);
      }
    }
    results.set(entity, { score: best, labels });
  }
  return results;
}

function scoreNegatives(headers: ReadonlySet<string>): Map<MigrationEntity, number> {
  const penalties = new Map<MigrationEntity, number>();
  for (const entity of MIGRATION_ENTITIES) {
    const hits = NEGATIVE_SIGNALS[entity].filter((signal) => headers.has(signal)).length;
    penalties.set(entity, Math.min(0.45, hits * 0.15));
  }
  return penalties;
}

export function classifySource(profile: SourceProfile): ClassificationResult {
  const normalizedHeaders = profile.columns.map((column) => column.normalizedHeader).filter(Boolean);

  if (!normalizedHeaders.length || profile.rowCount === 0) {
    return {
      classification: "unknown",
      confidence: 0,
      band: "low",
      reason: profile.rowCount === 0 ? "This file has no data rows." : "This file has no readable column headers.",
      runnerUp: null,
      scores: [],
    };
  }

  const expandedHeaders = expandHeaders(normalizedHeaders);
  const nameScores = scoreName(profile.fileName, profile.sheetName);
  const headerScores = scoreHeaders(normalizedHeaders);
  const signatureScores = scoreSignatures(expandedHeaders);
  const penalties = scoreNegatives(expandedHeaders);

  const combined: Array<{ classification: MigrationEntity; score: number; labels: string[] }> = MIGRATION_ENTITIES.map((entity) => {
    const signature = signatureScores.get(entity) || { score: 0, labels: [] };
    const raw =
      (nameScores.get(entity) || 0) * 0.22 +
      (headerScores.get(entity) || 0) * 0.28 +
      signature.score * 0.5;
    return {
      classification: entity,
      score: Math.max(0, Math.min(1, raw - (penalties.get(entity) || 0) * signature.score)),
      labels: signature.labels,
    };
  }).sort((a, b) => b.score - a.score);

  const top = combined[0];
  const runnerUp = combined[1];
  const scores = combined.map((item) => ({ classification: item.classification as SourceClassification, score: round(item.score) }));

  if (top.score < CLASSIFICATION_THRESHOLDS.medium) {
    return {
      classification: "unknown",
      confidence: round(top.score),
      band: "low",
      reason: "The columns in this file do not clearly match clients, projects, invoices, or expenses.",
      runnerUp: runnerUp ? { classification: runnerUp.classification, confidence: round(runnerUp.score) } : null,
      scores,
    };
  }

  // Two entities both well-supported and close together means the sheet really
  // does look like both. Say so rather than picking the marginal winner.
  if (
    runnerUp &&
    runnerUp.score >= CLASSIFICATION_THRESHOLDS.medium &&
    top.score - runnerUp.score < CLASSIFICATION_THRESHOLDS.ambiguityMargin
  ) {
    return {
      classification: "mixed",
      confidence: round(top.score),
      band: "low",
      reason: `This file looks like it could be ${describe(top.classification)} or ${describe(runnerUp.classification)}. Choose which one it is.`,
      runnerUp: { classification: runnerUp.classification, confidence: round(runnerUp.score) },
      scores,
    };
  }

  return {
    classification: top.classification,
    confidence: round(top.score),
    band: confidenceBand(top.score, CLASSIFICATION_THRESHOLDS.high, CLASSIFICATION_THRESHOLDS.medium),
    reason: buildReason(top.classification, top.labels, profile),
    runnerUp: runnerUp ? { classification: runnerUp.classification, confidence: round(runnerUp.score) } : null,
    scores,
  };
}

function describe(entity: MigrationEntity): string {
  return entity === "clients" ? "clients" : entity === "projects" ? "projects" : entity === "invoices" ? "invoices" : "expenses";
}

function buildReason(entity: MigrationEntity, labels: string[], profile: SourceProfile): string {
  const source = profile.sheetName ? `The "${profile.sheetName}" sheet` : "This file";
  if (labels.length) return `${source} has ${labels[0]}.`;
  const named = NAME_HINTS[entity].find((hint) => `${profile.sheetName || ""} ${profile.fileName}`.toLowerCase().includes(hint));
  if (named) return `${source} is named after ${describe(entity)} and its columns agree.`;
  return `${source} has columns that match ${describe(entity)}.`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Re-classify from an explicit user choice. Confidence becomes certainty. */
export function manualClassification(entity: SourceClassification): ClassificationResult {
  return {
    classification: entity,
    confidence: 1,
    band: "high",
    reason: "You chose this record type.",
    runnerUp: null,
    scores: [],
  };
}

export { normalizeHeader };
