/**
 * Column profiling.
 *
 * Profiling is what lets the engine reason about data instead of headers. A
 * column called `amount` that holds dates is a date column; a column called
 * `ref` that holds 94% valid emails is an email column. Every statistic here is
 * computed locally — nothing about the user's data leaves the process.
 */

import {
  containsCurrencyMarker,
  isBooleanLike,
  isEmail,
  isIdentifierLike,
  isNumeric,
  isPhone,
  isUrl,
  parseMoney,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./patterns.ts";
import {
  parseDateValue,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./normalize/date.ts";
import {
  MIGRATION_LIMITS,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./config.ts";
import type { ColumnProfile, InferredType, SourceProfile } from "./types.ts";
import {
  normalizeHeader,
  type SourceTable,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./parse/table.ts";

/** Ratio of non-empty values that must match before a type is claimed. */
const TYPE_CLAIM_THRESHOLD = 0.8;

function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 1000;
}

/**
 * Decide the column's primitive type from the measured ratios.
 *
 * Order matters: the most specific, least reversible interpretations are tested
 * first. An email column is also "text", but calling it text loses information,
 * whereas calling a text column "email" would be a false claim.
 */
function inferType(stats: {
  filled: number;
  email: number;
  url: number;
  phone: number;
  date: number;
  currency: number;
  number: number;
  boolean: number;
  identifier: number;
  distinct: number;
}): InferredType {
  if (stats.filled === 0) return "empty";
  const claims = (count: number) => count / stats.filled >= TYPE_CLAIM_THRESHOLD;

  if (claims(stats.email)) return "email";
  if (claims(stats.url)) return "url";
  if (claims(stats.date)) return "date";
  if (claims(stats.currency)) return "currency";
  if (claims(stats.boolean)) return "boolean";
  if (claims(stats.phone)) return "phone";
  if (claims(stats.identifier)) return "identifier";
  if (claims(stats.number)) return "number";
  // A small, repeating set of words is a status/category rather than free text.
  // Repetition is the signal, so the column must have fewer distinct values
  // than rows; the ratio bound keeps free text out on larger samples.
  if (stats.distinct <= 12 && stats.distinct < stats.filled && stats.distinct / stats.filled <= 0.6) {
    return "categorical";
  }
  return "text";
}

export function profileColumn(header: string, index: number, values: readonly string[]): ColumnProfile {
  const trimmed = values.map((value) => (value ?? "").trim());
  const filledValues = trimmed.filter(Boolean);
  const rowCount = trimmed.length;
  const filled = filledValues.length;

  const counts = { email: 0, url: 0, phone: 0, date: 0, currency: 0, number: 0, boolean: 0, identifier: 0 };
  const dateFormats = new Set<string>();
  const currencySymbols = new Set<string>();
  const frequency = new Map<string, number>();
  let minNumeric: number | null = null;
  let maxNumeric: number | null = null;
  let minText: string | null = null;
  let maxText: string | null = null;

  for (const value of filledValues) {
    frequency.set(value, (frequency.get(value) || 0) + 1);

    if (isEmail(value)) counts.email += 1;
    if (isUrl(value)) counts.url += 1;
    if (isPhone(value)) counts.phone += 1;
    if (isBooleanLike(value)) counts.boolean += 1;
    if (isIdentifierLike(value)) counts.identifier += 1;
    if (isNumeric(value)) counts.number += 1;

    const parsedDate = parseDateValue(value);
    if (parsedDate) {
      counts.date += 1;
      dateFormats.add(parsedDate.format);
      if (minText === null || parsedDate.iso < minText) minText = parsedDate.iso;
      if (maxText === null || parsedDate.iso > maxText) maxText = parsedDate.iso;
    }

    if (containsCurrencyMarker(value)) {
      const money = parseMoney(value);
      if (money) {
        counts.currency += 1;
        if (money.symbol) currencySymbols.add(money.symbol);
      }
    } else if (isNumeric(value)) {
      const money = parseMoney(value);
      if (money) {
        if (minNumeric === null || money.amount < minNumeric) minNumeric = money.amount;
        if (maxNumeric === null || money.amount > maxNumeric) maxNumeric = money.amount;
      }
    }
  }

  // A numeric column with currency markers on only some rows is still a money
  // column; the markers are formatting, not a different kind of value.
  if (counts.currency > 0 && counts.number > 0) {
    counts.currency = Math.max(counts.currency, counts.number);
  }

  const distinct = frequency.size;
  const categoricalValues = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MIGRATION_LIMITS.maxCategoricalValues)
    .map(([value, count]) => ({ value, count }));

  const inferredType = inferType({ ...counts, filled, distinct });

  return {
    header,
    normalizedHeader: normalizeHeader(header),
    index,
    rowCount,
    nullCount: rowCount - filled,
    nullPercentage: percentage(rowCount - filled, rowCount),
    uniqueCount: distinct,
    uniquePercentage: percentage(distinct, filled),
    inferredType,
    numberPercentage: percentage(counts.number, filled),
    currencyPercentage: percentage(counts.currency, filled),
    dateParsePercentage: percentage(counts.date, filled),
    emailPercentage: percentage(counts.email, filled),
    urlPercentage: percentage(counts.url, filled),
    phonePercentage: percentage(counts.phone, filled),
    booleanPercentage: percentage(counts.boolean, filled),
    identifierLikelihood: percentage(counts.identifier, filled),
    dateFormats: [...dateFormats],
    currencySymbols: [...currencySymbols],
    // Only meaningful for genuinely categorical data; a free-text column would
    // produce a useless list of every distinct sentence.
    categoricalValues: inferredType === "categorical" || inferredType === "boolean" ? categoricalValues : [],
    exampleValues: filledValues.slice(0, 3),
    min: minNumeric !== null ? String(minNumeric) : minText,
    max: maxNumeric !== null ? String(maxNumeric) : maxText,
  };
}

export function profileTable(table: SourceTable, sourceId: string): SourceProfile {
  const columns = table.headers.map((header, index) =>
    profileColumn(header, index, table.rows.map((row) => row[index] ?? "")),
  );
  return {
    sourceId,
    fileName: table.fileName,
    sheetName: table.sheetName,
    rowCount: table.rows.length,
    columns,
  };
}

/**
 * A short, human sentence explaining a column, used in the review UI.
 *
 * Written the way a colleague would describe it ("94% valid emails") rather
 * than as a statistics dump, per Rive's writing conventions.
 */
export function describeColumn(column: ColumnProfile): string {
  const share = (value: number) => `${Math.round(value * 100)}%`;
  switch (column.inferredType) {
    case "email":
      return `${share(column.emailPercentage)} valid email addresses`;
    case "date": {
      const formats = column.dateFormats.length > 1 ? `, ${column.dateFormats.length} formats` : "";
      return `${share(column.dateParsePercentage)} parse as dates${formats}`;
    }
    case "currency":
      return column.currencySymbols.length
        ? `Amounts using ${column.currencySymbols.join(", ")}`
        : `${share(column.currencyPercentage)} look like amounts`;
    case "number":
      return `${share(column.numberPercentage)} numeric`;
    case "url":
      return `${share(column.urlPercentage)} web addresses`;
    case "phone":
      return `${share(column.phonePercentage)} phone numbers`;
    case "boolean":
      return "Yes/no values";
    case "identifier":
      return `${share(column.identifierLikelihood)} look like reference numbers`;
    case "categorical":
      return `${column.uniqueCount} repeating values`;
    case "empty":
      return "No values";
    default:
      return `${share(1 - column.nullPercentage)} filled, ${share(column.uniquePercentage)} unique`;
  }
}
