/**
 * Row → canonical IR.
 *
 * This is the only place source values become Rive values. Nothing downstream
 * re-reads the upload, and `raw` is carried alongside `normalized` forever, so
 * every committed record can be traced back to the exact cell it came from.
 */

import {
  findField,
  type CanonicalField,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./fields.ts";
import {
  parseBoolean,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./patterns.ts";
import {
  inferColumnDatePreference,
  parseDateValue,
  type DayFirstPreference,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./normalize/date.ts";
import {
  resolveAmount,
  resolveCurrency,
  resolveRate,
  roundMoney,
  type CurrencyContext,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./normalize/money.ts";
import {
  enumSuggestions,
  resolveEnum,
  type EnumDomain,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./normalize/status.ts";
import {
  normalizeDisplayName,
  normalizeWhitespace,
  parseTags,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./normalize/text.ts";
import {
  isEmail,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./patterns.ts";
import {
  FIELD_LIMITS,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "../domain-vocabulary.ts";
import {
  displayRowNumber,
  rowToRecord,
  type SourceTable,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./parse/table.ts";
import type {
  MappingPlan,
  MigrationEntity,
  MigrationIssue,
  MigrationRecordIR,
} from "./types.ts";

/** Which enum domain a canonical field belongs to, if any. */
const ENUM_DOMAINS: Record<string, EnumDomain> = {
  "clients:status": "clientStatus",
  "projects:status": "projectStatus",
  "projects:priority": "projectPriority",
  "invoices:status": "invoiceStatus",
  "expenses:category": "expenseCategory",
};

/**
 * Value-level corrections the user made during review.
 *
 * Keyed by the raw source value rather than by row, so answering once ("Rs/-
 * means INR") resolves every row that used it. This is what makes bulk
 * resolution possible without asking the same question 23 times.
 */
export type ValueMappings = {
  currency?: Record<string, string>;
  status?: Record<string, string>;
  category?: Record<string, string>;
  priority?: Record<string, string>;
};

export type BuildContext = {
  sourceId: string;
  currency: Omit<CurrencyContext, "rowCurrency">;
  /** Date reading forced by the user during review, per column header. */
  datePreferences?: Record<string, DayFirstPreference>;
  valueMappings?: ValueMappings;
};

/** Look up a user correction for a raw value, case-insensitively. */
function userValue(mappings: Record<string, string> | undefined, raw: string): string | null {
  if (!mappings) return null;
  const direct = mappings[raw];
  if (direct) return direct;
  const key = Object.keys(mappings).find((candidate) => candidate.toLowerCase().trim() === raw.toLowerCase().trim());
  return key ? mappings[key] : null;
}

function warn(code: string, message: string, extra: Partial<MigrationIssue> = {}): MigrationIssue {
  return { code, severity: "warning", message, ...extra };
}

function fail(code: string, message: string, extra: Partial<MigrationIssue> = {}): MigrationIssue {
  return { code, severity: "error", message, ...extra };
}

/**
 * Work out how each date column should be read, once per source rather than
 * per row, so an unambiguous value anywhere in the column settles every
 * ambiguous value beside it.
 */
function resolveDatePreferences(
  table: SourceTable,
  fieldByColumn: Map<string, CanonicalField>,
  overrides: Record<string, DayFirstPreference>,
): Map<string, { preference: DayFirstPreference; evidence: string | null }> {
  const preferences = new Map<string, { preference: DayFirstPreference; evidence: string | null }>();
  for (const [index, header] of table.headers.entries()) {
    const field = fieldByColumn.get(header);
    if (!field || field.semanticType !== "date") continue;
    if (overrides[header]) {
      preferences.set(header, { preference: overrides[header], evidence: "You confirmed this date format." });
      continue;
    }
    preferences.set(header, inferColumnDatePreference(table.rows.map((row) => row[index] ?? "")));
  }
  return preferences;
}

function truncate(value: string, limit: number | undefined): { value: string; truncated: boolean } {
  if (!limit || value.length <= limit) return { value, truncated: false };
  return { value: value.slice(0, limit), truncated: true };
}

export function buildRecords(
  table: SourceTable,
  mappingPlan: MappingPlan,
  entity: MigrationEntity,
  context: BuildContext,
): MigrationRecordIR[] {
  const fieldByColumn = new Map<string, CanonicalField>();
  for (const mapping of mappingPlan.mappings) {
    if (!mapping.target || mapping.status === "IGNORED" || mapping.status === "UNRESOLVED") continue;
    const field = findField(entity, mapping.target);
    if (field) fieldByColumn.set(mapping.sourceColumn, field);
  }

  const datePreferences = resolveDatePreferences(table, fieldByColumn, context.datePreferences || {});
  const mappingConfidence = new Map(mappingPlan.mappings.map((mapping) => [mapping.sourceColumn, mapping.confidence]));

  return table.rows.map((row, rowIndex) => {
    const raw = rowToRecord(table.headers, row);
    const normalized: Record<string, unknown> = {};
    const warnings: MigrationIssue[] = [];
    const errors: MigrationIssue[] = [];
    const fieldMappings: Record<string, string> = {};
    let rowCurrencyToken = "";
    let amountParseForCurrency: ReturnType<typeof resolveAmount>["parse"] = null;

    for (const [column, field] of fieldByColumn) {
      fieldMappings[column] = field.key;
      const value = (raw[column] ?? "").trim();
      if (!value) continue;

      switch (field.semanticType) {
        case "currency":
          rowCurrencyToken = value;
          break;

        case "money": {
          const resolved = resolveAmount(value);
          if (resolved.error) {
            errors.push(fail("AMOUNT_UNREADABLE", resolved.error, { field: field.key, sourceValue: value }));
            break;
          }
          if (resolved.amount !== null) {
            normalized[field.key] = resolved.amount;
            // Keep the first monetary parse that carried a symbol; it is the
            // strongest in-row evidence of currency.
            if (!amountParseForCurrency && resolved.parse && (resolved.parse.currency || resolved.parse.ambiguousCurrencies.length)) {
              amountParseForCurrency = resolved.parse;
            }
          }
          break;
        }

        case "rate": {
          const { rate, error } = resolveRate(value);
          if (error) warnings.push(warn("RATE_UNREADABLE", error, { field: field.key, sourceValue: value }));
          else if (rate !== null) normalized[field.key] = rate;
          break;
        }

        case "date": {
          const preference = datePreferences.get(column) || { preference: "auto" as DayFirstPreference, evidence: null };
          const parsed = parseDateValue(value, preference.preference);
          if (!parsed) {
            warnings.push(warn("DATE_UNREADABLE", `"${value}" is not a date Rive can read.`, { field: field.key, sourceValue: value }));
            break;
          }
          normalized[field.key] = parsed.iso;
          // Only ask when nothing in the column settles the reading. If a
          // sibling row has a day above 12, the format is known and repeating
          // the question for every other row is noise, not diligence.
          if (parsed.ambiguous && parsed.alternative && preference.preference === "auto") {
            warnings.push(
              warn(
                "DATE_AMBIGUOUS",
                `"${value}" could be ${parsed.iso} or ${parsed.alternative}.`,
                {
                  field: field.key,
                  sourceValue: value,
                  suggestions: [
                    { label: formatDateSuggestion(parsed.iso), value: "dmy" },
                    { label: formatDateSuggestion(parsed.alternative), value: "mdy" },
                  ],
                },
              ),
            );
          }
          break;
        }

        case "email": {
          const lowered = value.toLowerCase();
          if (!isEmail(lowered)) {
            warnings.push(warn("EMAIL_INVALID", `"${value}" is not a valid email address.`, { field: field.key, sourceValue: value }));
            break;
          }
          normalized[field.key] = lowered;
          break;
        }

        case "phone": {
          // Normalized but never invented: spacing is tidied, no country code
          // is added, because a wrong country code is worse than a messy one.
          normalized[field.key] = normalizeWhitespace(value).slice(0, FIELD_LIMITS.clientPhone);
          break;
        }

        case "url": {
          const tidy = normalizeWhitespace(value);
          normalized[field.key] = /^https?:\/\//i.test(tidy) ? tidy : `https://${tidy.replace(/^\/+/, "")}`;
          break;
        }

        case "boolean": {
          const parsed = parseBoolean(value);
          if (parsed === null) {
            warnings.push(warn("BOOLEAN_UNREADABLE", `"${value}" is not a yes or no value.`, { field: field.key, sourceValue: value }));
            break;
          }
          normalized[field.key] = parsed;
          break;
        }

        case "enum": {
          const domain = ENUM_DOMAINS[`${entity}:${field.key}`];
          if (!domain) break;

          // A correction the user already made for this exact source value
          // settles it for every row, with no further questions.
          const corrected = userValue(
            field.key === "category"
              ? context.valueMappings?.category
              : field.key === "priority"
                ? context.valueMappings?.priority
                : context.valueMappings?.status,
            value,
          );
          if (corrected) {
            normalized[field.key] = corrected;
            break;
          }

          const resolved = resolveEnum(domain, value);
          if (resolved.value) {
            normalized[field.key] = resolved.value;
            if (resolved.matched === "fuzzy") {
              warnings.push(warn("STATUS_INFERRED", `${resolved.reason} Confirm if that is wrong.`, { field: field.key, sourceValue: value }));
            }
            break;
          }
          warnings.push(
            warn("STATUS_UNKNOWN", resolved.reason, {
              field: field.key,
              sourceValue: value,
              suggestions: enumSuggestions(domain, value).slice(0, 4),
            }),
          );
          break;
        }

        case "tags": {
          normalized[field.key] = parseTags(value, FIELD_LIMITS.tagsPerRecord);
          break;
        }

        case "reference": {
          // Kept as text; relationship resolution happens across all sources
          // once every file has been read.
          normalized[field.key] = normalizeDisplayName(value);
          break;
        }

        case "identifier": {
          const { value: trimmed, truncated } = truncate(normalizeWhitespace(value), field.maxLength);
          normalized[field.key] = trimmed;
          if (truncated) {
            warnings.push(warn("VALUE_TRUNCATED", `${field.label} was shortened to ${field.maxLength} characters.`, { field: field.key, sourceValue: value }));
          }
          break;
        }

        case "text":
        case "longtext":
        default: {
          const { value: tidy, truncated } = truncate(normalizeDisplayName(value), field.maxLength);
          normalized[field.key] = tidy;
          if (truncated) {
            warnings.push(warn("VALUE_TRUNCATED", `${field.label} was shortened to ${field.maxLength} characters.`, { field: field.key, sourceValue: value }));
          }
          break;
        }
      }
    }

    applyEntityRules(entity, normalized, warnings);

    // Currency is resolved once per record, after amounts are known, so an
    // embedded symbol can contribute.
    if (entityNeedsCurrency(entity, normalized)) {
      // A user's answer for an ambiguous token ("Rs/-" → INR, "$" → SGD)
      // outranks every inference, including the row's own symbol.
      const correctedCurrency =
        userValue(context.valueMappings?.currency, rowCurrencyToken) ||
        userValue(context.valueMappings?.currency, amountParseForCurrency?.symbol || "");

      const resolution = correctedCurrency
        ? { currency: correctedCurrency, source: "row" as const, ambiguousCandidates: [], reason: `You chose ${correctedCurrency}.` }
        : resolveCurrency({ ...context.currency, rowCurrency: rowCurrencyToken }, amountParseForCurrency);

      if (resolution.currency) {
        normalized.currency = resolution.currency;
        normalized.currencySource = resolution.source;
      } else {
        warnings.push(
          warn("CURRENCY_AMBIGUOUS", resolution.reason, {
            field: "currency",
            sourceValue: rowCurrencyToken || amountParseForCurrency?.symbol || "",
            suggestions: resolution.ambiguousCandidates.map((code) => ({ label: code, value: code })),
          }),
        );
      }
    }

    const confidences = Object.keys(fieldMappings).map((column) => mappingConfidence.get(column) ?? 0);
    const confidence = confidences.length
      ? Math.round((confidences.reduce((sum, value) => sum + value, 0) / confidences.length) * 100) / 100
      : 0;

    const sourceRow = displayRowNumber(table, rowIndex);
    return {
      entity,
      source: {
        sourceId: context.sourceId,
        fileName: table.fileName,
        sheetName: table.sheetName,
        sourceRow,
        sourceKey: `${context.sourceId}:${sourceRow}`,
        externalId: typeof normalized.externalId === "string" && normalized.externalId ? normalized.externalId : null,
      },
      raw,
      normalized,
      fieldMappings,
      confidence,
      warnings,
      errors,
      relationshipCandidates: [],
      resolvedRelationships: {},
      duplicateCandidates: [],
      groupKey: null,
      status: errors.length ? "error" : "ready",
      action: errors.length ? "skip" : "create",
    };
  });
}

function entityNeedsCurrency(entity: MigrationEntity, normalized: Record<string, unknown>): boolean {
  if (entity === "invoices" || entity === "expenses") return true;
  // A project only needs a currency once it actually carries a budget.
  return entity === "projects" && typeof normalized.budget === "number";
}

function formatDateSuggestion(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Per-entity arithmetic that can be derived rather than asked about.
 *
 * Only relationships that are definitionally true are filled in: a total is
 * subtotal plus tax. Nothing is invented where the source is simply missing.
 */
function applyEntityRules(entity: MigrationEntity, normalized: Record<string, unknown>, warnings: MigrationIssue[]): void {
  if (entity !== "invoices") return;

  const subtotal = typeof normalized.subtotal === "number" ? normalized.subtotal : null;
  const tax = typeof normalized.taxAmount === "number" ? normalized.taxAmount : null;
  const total = typeof normalized.total === "number" ? normalized.total : null;

  if (total === null && subtotal !== null) {
    normalized.total = roundMoney(subtotal + (tax || 0));
  } else if (subtotal === null && total !== null) {
    normalized.subtotal = roundMoney(total - (tax || 0));
  }

  const finalSubtotal = typeof normalized.subtotal === "number" ? normalized.subtotal : null;
  const finalTotal = typeof normalized.total === "number" ? normalized.total : null;
  if (finalSubtotal !== null && finalTotal !== null && tax !== null) {
    const expected = roundMoney(finalSubtotal + tax);
    // A cent of drift is rounding in the source system; more is a real
    // disagreement the user should see rather than have quietly overwritten.
    if (Math.abs(expected - finalTotal) > 0.01) {
      warnings.push(
        warn("TOTAL_MISMATCH", `Subtotal and tax add up to ${expected.toFixed(2)}, but the total says ${finalTotal.toFixed(2)}. Rive kept the total.`, {
          field: "total",
          sourceValue: String(finalTotal),
        }),
      );
    }
  }
}
