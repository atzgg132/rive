/**
 * Text normalization.
 *
 * The display value and the comparison value are deliberately different things.
 * "Acme Technologies Pvt Ltd" is what the user sees and what gets stored;
 * "acme technologies" is what the matcher reasons about. The engine never
 * shows the comparison form or stores it in place of the original.
 */

/** Collapse runs of whitespace and trim, preserving the author's casing. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Display form of a person or business name. Zero-width and non-breaking
 * characters are stripped because they survive copy-paste from web exports and
 * silently break exact-match deduplication.
 */
export function normalizeDisplayName(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/[​-‍﻿]/g, "")
      .replace(/ /g, " "),
  );
}

/**
 * Company suffixes that are safe to ignore when comparing names.
 *
 * Kept conservative on purpose. Longer forms come first so "private limited" is
 * removed before "limited" can match half of it.
 */
const COMPANY_SUFFIXES = [
  "private limited",
  "pvt ltd",
  "pvt limited",
  "pte ltd",
  "public limited company",
  "limited liability company",
  "limited liability partnership",
  "incorporated",
  "corporation",
  "company",
  "holdings",
  "ventures",
  "gmbh",
  "s a r l",
  "sarl",
  "llp",
  "llc",
  "ltd",
  "inc",
  "plc",
  "pty",
  "corp",
  "bv",
  "nv",
  "ag",
  "sa",
  "srl",
  "oy",
  "ab",
  "co",
];

/** Lowercase, strip punctuation, collapse whitespace. No suffix removal. */
export function comparisonForm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[​-‍﻿]/g, "")
    .replace(/[&]/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Comparison form with trailing legal suffixes removed.
 *
 * Only trailing suffixes are stripped, and never the entire name: "Ltd" alone
 * stays "ltd" rather than becoming empty, so two unrelated one-word companies
 * cannot collapse into the same key.
 */
export function companyComparisonForm(value: string): string {
  let working = comparisonForm(value);
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of COMPANY_SUFFIXES) {
      if (working === suffix) return working;
      if (working.endsWith(` ${suffix}`)) {
        const candidate = working.slice(0, -(suffix.length + 1)).trim();
        if (candidate) {
          working = candidate;
          changed = true;
          break;
        }
      }
    }
  }
  return working;
}

/** Split a delimited tag cell into clean tags. */
export function parseTags(value: string, limit: number): string[] {
  return value
    .split(/[,;|/]/)
    .map((tag) => normalizeWhitespace(tag))
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Neutralize leading characters a spreadsheet would execute as a formula.
 *
 * Applied to any value the product writes back into a CSV export or a
 * downloadable preview, so imported data cannot turn into a payload in the
 * user's own spreadsheet later.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
