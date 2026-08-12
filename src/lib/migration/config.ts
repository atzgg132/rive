/**
 * Tunable constants for the deterministic migration engine.
 *
 * Everything that decides "how sure are we?" lives here so the weights and
 * thresholds can be adjusted and unit-tested without touching pipeline code.
 * Nothing in this file may import server-only modules: the whole engine is
 * pure so it can run under `node --test` with no database.
 */

/** Bumped whenever scoring, normalization, or plan shape changes semantics. */
export const MIGRATION_ENGINE_VERSION = 2;

/**
 * Upload limits. These are deliberately explicit rather than silent: the API
 * rejects oversized migrations instead of truncating them, and the UI shows the
 * same numbers so a user never discovers a limit by losing rows.
 */
export const MIGRATION_LIMITS = {
  maxFiles: 10,
  maxSheetsPerWorkbook: 12,
  maxFileBytes: 5 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxRowsPerSource: 10_000,
  maxTotalRows: 20_000,
  maxColumns: 128,
  /** Rows kept per file for the review UI. Full data stays server-side. */
  previewRows: 5,
  /** Distinct values retained per column while profiling. */
  maxCategoricalValues: 24,
  commitBatchSize: 200,
} as const;

/**
 * Field-mapping confidence weights. They sum to 1.0.
 *
 * `header` dominates because a header is an explicit human statement of intent,
 * but it can never win alone: `typeCompatibility` is a hard gate elsewhere, so
 * a date column cannot be mapped to an amount field regardless of its name.
 */
export const MAPPING_WEIGHTS = {
  header: 0.4,
  typeCompatibility: 0.2,
  valuePattern: 0.15,
  crossColumnContext: 0.15,
  adapterHint: 0.1,
} as const;

export const MAPPING_THRESHOLDS = {
  /** At or above: mapped automatically, not surfaced for review. */
  high: 0.78,
  /** At or above: mapped but shown during review so the user can correct it. */
  medium: 0.55,
  /**
   * Below `medium` the field is left UNRESOLVED. We deliberately do not guess:
   * a wrong silent mapping costs more trust than one honest question.
   */
} as const;

/** Entity-classification thresholds, scored independently of field mapping. */
export const CLASSIFICATION_THRESHOLDS = {
  high: 0.7,
  medium: 0.45,
  /** Two entities within this margin means the sheet is genuinely ambiguous. */
  ambiguityMargin: 0.12,
} as const;

/**
 * Relationship + duplicate thresholds.
 *
 * `autoMerge` is intentionally very high and is only ever reachable with
 * corroborating evidence (see `identity.ts`). Fuzzy name similarity alone can
 * never auto-merge, no matter how high it scores.
 */
export const MATCH_THRESHOLDS = {
  /** Strong identifier match (email, external id, tax id). Safe to link. */
  strong: 0.9,
  /** Suggest a link/merge, but require the user to confirm it. */
  suggest: 0.72,
  /** Below this, do not even offer the candidate. */
  floor: 0.6,
  /** Fuzzy-only name similarity needed before we will *suggest* anything. */
  fuzzyNameSuggest: 0.86,
} as const;

/**
 * Currency resolution order. Documented here because "where did this currency
 * come from?" is the question users ask when an amount looks wrong.
 */
export const CURRENCY_RESOLUTION_ORDER = [
  "row", // explicit currency column on the row
  "source", // currency stated in file/sheet metadata
  "migrationDefault", // user's choice for this migration session
  "workspace", // the workspace default currency
] as const;

export type CurrencySource = (typeof CURRENCY_RESOLUTION_ORDER)[number];
