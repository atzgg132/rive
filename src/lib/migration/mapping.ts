/**
 * Deterministic field mapping.
 *
 * Every source column is scored against every canonical field of the source's
 * entity across five independent signals, then columns and fields are matched
 * one-to-one. The scoring is intentionally conservative: type incompatibility
 * is a hard veto, and anything that finishes below the medium threshold is
 * returned UNRESOLVED rather than mapped to the least-bad option.
 *
 * The output shape is the contract a future LLM resolver consumes. See
 * `resolver.ts`.
 */

import {
  MAPPING_THRESHOLDS,
  MAPPING_WEIGHTS,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./config.ts";
import {
  fieldsForEntity,
  requiredFields,
  type CanonicalField,
  type SemanticType,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./fields.ts";
import {
  headerSimilarity,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./fuzzy.ts";
import {
  confidenceBand,
  type ColumnProfile,
  type FieldMapping,
  type MappingPlan,
  type MigrationEntity,
  type SourceProfile,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./types.ts";
import type { AdapterHintIndex } from "./adapters/types.ts";

/**
 * Contextual boosts: a mapping is more likely when specific sibling columns
 * exist. This is what turns `customer` from "some text column" into "the client
 * this invoice belongs to".
 */
type ContextRule = { entity: MigrationEntity; target: string; requires: string[]; boost: number };

const CONTEXT_RULES: ContextRule[] = [
  { entity: "invoices", target: "clientRef", requires: ["invoice_number", "invoice_no", "bill_no", "total", "amount", "due_date"], boost: 1 },
  { entity: "invoices", target: "total", requires: ["subtotal", "tax", "tax_amount", "gst", "vat"], boost: 0.9 },
  { entity: "invoices", target: "subtotal", requires: ["tax", "tax_amount", "gst", "vat", "total"], boost: 0.9 },
  { entity: "invoices", target: "projectRef", requires: ["invoice_number", "invoice_no", "total"], boost: 0.7 },
  { entity: "invoices", target: "issueDate", requires: ["due_date", "payment_due"], boost: 0.8 },
  { entity: "projects", target: "clientRef", requires: ["project_name", "project_title", "project", "deadline", "budget"], boost: 1 },
  { entity: "projects", target: "budget", requires: ["project_name", "project_title", "client", "deadline"], boost: 0.8 },
  { entity: "expenses", target: "projectRef", requires: ["amount", "expense_date", "category"], boost: 0.7 },
  { entity: "expenses", target: "description", requires: ["amount", "expense_date"], boost: 0.8 },
  { entity: "expenses", target: "amount", requires: ["expense_date", "category", "merchant", "vendor"], boost: 0.9 },
  { entity: "clients", target: "name", requires: ["email", "phone", "company", "address"], boost: 0.9 },
];

/**
 * How well the column's measured value patterns support a field's meaning.
 *
 * This is the signal that stops a plausible header from carrying a bad mapping:
 * a column called `customer_email` holding phone numbers scores near zero here.
 */
function scoreValuePattern(field: CanonicalField, column: ColumnProfile): number {
  const type: SemanticType = field.semanticType;
  switch (type) {
    case "email":
      return column.emailPercentage;
    case "url":
      return column.urlPercentage;
    case "phone":
      return column.phonePercentage;
    case "date":
      return column.dateParsePercentage;
    case "money":
      return Math.max(column.currencyPercentage, column.numberPercentage);
    case "rate":
      // A tax rate is a small number, not a monetary total.
      return column.numberPercentage * (isSmallNumericRange(column) ? 1 : 0.4);
    case "identifier": {
      // Reference numbers are near-unique. A repeating "invoice number" is
      // almost certainly something else.
      const uniqueness = column.uniquePercentage;
      return Math.max(column.identifierLikelihood, uniqueness > 0.9 ? 0.8 : uniqueness * 0.5);
    }
    case "enum":
      // Statuses and categories repeat. High cardinality argues against.
      return column.inferredType === "categorical" || column.inferredType === "boolean"
        ? 1
        : Math.max(0, 1 - column.uniquePercentage);
    case "boolean":
      return Math.max(column.booleanPercentage, column.inferredType === "categorical" && column.uniqueCount <= 3 ? 0.7 : 0);
    case "currency":
      return scoreCurrencyColumn(column);
    case "tags":
      return column.inferredType === "text" || column.inferredType === "categorical" ? 0.6 : 0.2;
    case "reference":
      // Relationship columns hold repeated names: many rows, fewer parties.
      return column.inferredType === "text" || column.inferredType === "categorical"
        ? Math.max(0.5, 1 - column.uniquePercentage * 0.5)
        : 0.25;
    case "longtext":
      return column.inferredType === "text" ? 0.7 : 0.3;
    case "text":
    default:
      return column.inferredType === "text" || column.inferredType === "categorical" ? 0.7 : 0.35;
  }
}

function isSmallNumericRange(column: ColumnProfile): boolean {
  const max = Number(column.max);
  return Number.isFinite(max) && Math.abs(max) <= 100;
}

/** A currency column holds short codes or symbols, not amounts or prose. */
function scoreCurrencyColumn(column: ColumnProfile): number {
  if (!column.categoricalValues.length && column.inferredType !== "text") {
    return column.uniqueCount > 0 && column.uniqueCount <= 8 ? 0.6 : 0.2;
  }
  const values = column.categoricalValues.length
    ? column.categoricalValues.map((entry) => entry.value)
    : column.exampleValues;
  if (!values.length) return 0.2;
  const codeLike = values.filter((value) => /^[A-Za-z]{3}$/.test(value.trim()) || value.trim().length <= 3).length;
  return codeLike / values.length;
}

/**
 * Type compatibility, used both as a signal and as a veto.
 *
 * Returning null means the mapping is impossible and the pair is discarded
 * entirely — this is what guarantees a date column can never become an amount
 * no matter how similar the headers are.
 */
function scoreTypeCompatibility(field: CanonicalField, column: ColumnProfile): number | null {
  if (column.inferredType === "empty") return 0.2;
  if (field.rejectedTypes.includes(column.inferredType)) return null;
  if (field.acceptedTypes.includes(column.inferredType)) return 1;
  return 0.45;
}

function scoreHeader(field: CanonicalField, column: ColumnProfile): number {
  let best = 0;
  for (const alias of field.aliases) {
    const score = headerSimilarity(column.normalizedHeader, alias);
    if (score > best) best = score;
    if (best === 1) break;
  }
  return best;
}

function scoreContext(field: CanonicalField, presentHeaders: ReadonlySet<string>): number {
  let best = 0;
  for (const rule of CONTEXT_RULES) {
    if (rule.entity !== field.entity || rule.target !== field.key) continue;
    if (rule.requires.some((header) => presentHeaders.has(header))) best = Math.max(best, rule.boost);
  }
  return best;
}

/**
 * Whether the engine holds any contextual opinion about this field.
 *
 * When a rule exists but its sibling columns are absent, that is real negative
 * evidence and the zero counts. When no rule exists at all, context is simply
 * not a question we can ask, and it must not drag the score down.
 */
function hasContextOpinion(field: CanonicalField): boolean {
  return CONTEXT_RULES.some((rule) => rule.entity === field.entity && rule.target === field.key);
}

function scoreAdapterHint(field: CanonicalField, column: ColumnProfile, hints: AdapterHintIndex | null): number {
  if (!hints) return 0;
  const byEntity = hints.headerAliases.get(column.normalizedHeader);
  if (!byEntity) return 0;
  return byEntity.get(field.entity) === field.key ? 1 : 0;
}

type Candidate = {
  columnIndex: number;
  field: CanonicalField;
  confidence: number;
  signals: FieldMapping["signals"];
};

function buildReason(field: CanonicalField, column: ColumnProfile, signals: FieldMapping["signals"]): string {
  const parts: string[] = [];
  if (signals.header >= 0.99) parts.push(`the column is named "${column.header}"`);
  else if (signals.header >= 0.7) parts.push(`"${column.header}" closely resembles "${field.label}"`);

  const share = Math.round(signals.valuePattern * 100);
  if (signals.valuePattern >= 0.8) {
    switch (field.semanticType) {
      case "email": parts.push(`${share}% of values are valid email addresses`); break;
      case "date": parts.push(`${share}% of values parse as dates`); break;
      case "money": parts.push(`${share}% of values are amounts`); break;
      case "url": parts.push(`${share}% of values are web addresses`); break;
      case "phone": parts.push(`${share}% of values are phone numbers`); break;
      case "identifier": parts.push("the values are near-unique reference numbers"); break;
      case "enum": parts.push(`the column repeats ${column.uniqueCount} values`); break;
      default: break;
    }
  }
  if (signals.crossColumnContext >= 0.7) parts.push("the surrounding columns fit this record type");
  if (signals.adapterHint >= 1) parts.push("this source's known field names match");

  if (!parts.length) return `Best available match for ${field.label}.`;
  const sentence = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Mapped to ${field.label} because ${sentence}.`;
}

/**
 * Map every column of a source onto the canonical fields of its entity.
 *
 * Assignment runs in two passes so required fields are satisfied first. Without
 * that, a clients sheet whose only name-bearing column is `company` could leave
 * the required `name` field empty while `company` took the optional slot.
 */
export function buildMappingPlan(
  profile: SourceProfile,
  entity: MigrationEntity,
  hints: AdapterHintIndex | null = null,
  manualOverrides: Record<string, string | null> = {},
): MappingPlan {
  const fields = fieldsForEntity(entity);
  const presentHeaders = new Set(profile.columns.map((column) => column.normalizedHeader));
  const candidates: Candidate[] = [];

  for (const [columnIndex, column] of profile.columns.entries()) {
    for (const field of fields) {
      const typeScore = scoreTypeCompatibility(field, column);
      if (typeScore === null) continue; // hard veto

      const signals = {
        header: scoreHeader(field, column),
        typeCompatibility: typeScore,
        valuePattern: scoreValuePattern(field, column),
        crossColumnContext: scoreContext(field, presentHeaders),
        adapterHint: scoreAdapterHint(field, column, hints),
      };

      // Score over the signals that can actually be evaluated, then renormalize.
      //
      // Cross-column context and adapter hints are not available for every
      // field: a generic CSV has no vendor adapter, and most fields have no
      // contextual rule. Charging them as missing points would cap a perfect
      // header + type + value match at 0.75 and put every obvious mapping into
      // review. Renormalizing keeps the documented weight *ratios* intact while
      // letting unambiguous evidence reach the auto-map threshold.
      let weighted =
        signals.header * MAPPING_WEIGHTS.header +
        signals.typeCompatibility * MAPPING_WEIGHTS.typeCompatibility +
        signals.valuePattern * MAPPING_WEIGHTS.valuePattern;
      let availableWeight = MAPPING_WEIGHTS.header + MAPPING_WEIGHTS.typeCompatibility + MAPPING_WEIGHTS.valuePattern;

      if (hasContextOpinion(field)) {
        weighted += signals.crossColumnContext * MAPPING_WEIGHTS.crossColumnContext;
        availableWeight += MAPPING_WEIGHTS.crossColumnContext;
      }
      if (hints?.headerAliases.has(column.normalizedHeader)) {
        weighted += signals.adapterHint * MAPPING_WEIGHTS.adapterHint;
        availableWeight += MAPPING_WEIGHTS.adapterHint;
      }
      const confidence = weighted / availableWeight;

      // A column with no header agreement at all is not a mapping, it is a
      // coincidence of data shape. Requiring a minimum keeps unrelated text
      // columns from being absorbed into whichever text field is still free.
      if (signals.header < 0.34) continue;
      candidates.push({ columnIndex, field, confidence, signals });
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence || a.field.key.localeCompare(b.field.key));

  const takenColumns = new Set<number>();
  const takenFields = new Set<string>();
  const assigned = new Map<number, Candidate>();

  const assign = (pool: Candidate[]) => {
    for (const candidate of pool) {
      if (takenColumns.has(candidate.columnIndex) || takenFields.has(candidate.field.key)) continue;
      if (candidate.confidence < MAPPING_THRESHOLDS.medium) continue;
      takenColumns.add(candidate.columnIndex);
      takenFields.add(candidate.field.key);
      assigned.set(candidate.columnIndex, candidate);
    }
  };

  const requiredKeys = new Set(requiredFields(entity).map((field) => field.key));
  assign(candidates.filter((candidate) => requiredKeys.has(candidate.field.key)));
  assign(candidates);

  const mappings: FieldMapping[] = profile.columns.map((column, columnIndex) => {
    const alternatives = candidates
      .filter((candidate) => candidate.columnIndex === columnIndex)
      .slice(0, 4)
      .map((candidate) => ({
        target: candidate.field.key,
        confidence: round(candidate.confidence),
        reason: buildReason(candidate.field, column, candidate.signals),
      }));

    const override = manualOverrides[column.header];
    if (override !== undefined) {
      const field = fields.find((item) => item.key === override);
      return {
        sourceColumn: column.header,
        target: field ? field.key : null,
        confidence: 1,
        band: "high",
        status: field ? "MANUAL" : "IGNORED",
        reason: field ? `You mapped this column to ${field.label}.` : "You chose to ignore this column.",
        signals: { header: 0, typeCompatibility: 0, valuePattern: 0, crossColumnContext: 0, adapterHint: 0 },
        candidateMappings: alternatives,
      };
    }

    const winner = assigned.get(columnIndex);
    if (!winner) {
      const best = alternatives[0];
      return {
        sourceColumn: column.header,
        target: null,
        confidence: best ? best.confidence : 0,
        band: "low",
        status: "UNRESOLVED",
        reason: best
          ? `"${column.header}" might be ${describeTarget(fields, best.target)}, but the match is not strong enough to rely on.`
          : `"${column.header}" does not match any ${entity.replace(/s$/, "")} field.`,
        signals: { header: 0, typeCompatibility: 0, valuePattern: 0, crossColumnContext: 0, adapterHint: 0 },
        candidateMappings: alternatives,
      };
    }

    const band = confidenceBand(winner.confidence, MAPPING_THRESHOLDS.high, MAPPING_THRESHOLDS.medium);
    return {
      sourceColumn: column.header,
      target: winner.field.key,
      confidence: round(winner.confidence),
      band,
      status: band === "high" ? "AUTO" : "SUGGESTED",
      reason: buildReason(winner.field, column, winner.signals),
      signals: {
        header: round(winner.signals.header),
        typeCompatibility: round(winner.signals.typeCompatibility),
        valuePattern: round(winner.signals.valuePattern),
        crossColumnContext: round(winner.signals.crossColumnContext),
        adapterHint: round(winner.signals.adapterHint),
      },
      candidateMappings: alternatives.filter((item) => item.target !== winner.field.key),
    };
  });

  const mappedTargets = new Set(mappings.map((mapping) => mapping.target).filter(Boolean) as string[]);
  const missingRequired = requiredFields(entity)
    .filter((field) => !mappedTargets.has(field.key))
    .map((field) => field.key);

  const mappable = mappings.filter((mapping) => mapping.status !== "IGNORED");
  return {
    sourceId: profile.sourceId,
    entity,
    mappings,
    missingRequired,
    autoMappedCount: mappings.filter((mapping) => mapping.status === "AUTO").length,
    totalMappableColumns: mappable.length,
  };
}

function describeTarget(fields: CanonicalField[], key: string): string {
  return fields.find((field) => field.key === key)?.label.toLowerCase() || key;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Column header → canonical field key, for the columns that resolved. */
export function resolvedFieldMap(plan: MappingPlan): Record<string, string> {
  const map: Record<string, string> = {};
  for (const mapping of plan.mappings) {
    if (mapping.target && mapping.status !== "IGNORED") map[mapping.sourceColumn] = mapping.target;
  }
  return map;
}
