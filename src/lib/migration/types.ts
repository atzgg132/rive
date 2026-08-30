/**
 * Canonical migration intermediate representation (IR).
 *
 * Source rows are never translated straight into Rive records. Everything
 * becomes an IR record first, and only validated IR is compiled into an import
 * plan. Future source adapters (Zoho Books, QuickBooks, Bonsai) target this
 * same IR, so none of them can reach the database directly.
 */

export const MIGRATION_ENTITIES = ["clients", "projects", "invoices", "expenses"] as const;
export type MigrationEntity = (typeof MIGRATION_ENTITIES)[number];

/** What a file or sheet was judged to contain. */
export const SOURCE_CLASSIFICATIONS = [...MIGRATION_ENTITIES, "mixed", "unknown"] as const;
export type SourceClassification = (typeof SOURCE_CLASSIFICATIONS)[number];

export type ConfidenceBand = "high" | "medium" | "low";

/** Primitive shape inferred for a column from its values, not its header. */
export type InferredType =
  | "empty"
  | "number"
  | "currency"
  | "date"
  | "boolean"
  | "email"
  | "url"
  | "phone"
  | "identifier"
  | "categorical"
  | "text";

export type ColumnProfile = {
  header: string;
  /** Header normalized to snake_case for matching. Display uses `header`. */
  normalizedHeader: string;
  index: number;
  rowCount: number;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  inferredType: InferredType;
  numberPercentage: number;
  currencyPercentage: number;
  dateParsePercentage: number;
  emailPercentage: number;
  urlPercentage: number;
  phonePercentage: number;
  booleanPercentage: number;
  identifierLikelihood: number;
  /** Distinct date formats seen, e.g. ["ISO", "DMY"]. Ambiguity is a warning. */
  dateFormats: string[];
  /** Currency codes/symbols detected in the raw values. */
  currencySymbols: string[];
  categoricalValues: Array<{ value: string; count: number }>;
  exampleValues: string[];
  min: string | null;
  max: string | null;
};

export type SourceProfile = {
  sourceId: string;
  fileName: string;
  sheetName: string | null;
  rowCount: number;
  columns: ColumnProfile[];
};

export type ClassificationResult = {
  classification: SourceClassification;
  confidence: number;
  band: ConfidenceBand;
  /** Human-readable, shown in the UI. Never a stack trace or internal code. */
  reason: string;
  runnerUp: { classification: SourceClassification; confidence: number } | null;
  scores: Array<{ classification: SourceClassification; score: number }>;
};

/**
 * The outcome of trying to map one source column to a canonical Rive field.
 *
 * `status: "UNRESOLVED"` with `target: null` is the shape a future LLM resolver
 * consumes. The deterministic engine emits it and stops; nothing downstream
 * guesses on its behalf.
 */
export type FieldMapping = {
  sourceColumn: string;
  target: string | null;
  confidence: number;
  band: ConfidenceBand;
  status: "AUTO" | "SUGGESTED" | "UNRESOLVED" | "IGNORED" | "MANUAL";
  reason: string;
  signals: {
    header: number;
    typeCompatibility: number;
    valuePattern: number;
    crossColumnContext: number;
    adapterHint: number;
  };
  candidateMappings: Array<{ target: string; confidence: number; reason: string }>;
};

export type MappingPlan = {
  sourceId: string;
  entity: MigrationEntity;
  mappings: FieldMapping[];
  /** Canonical fields the entity needs that no column could supply. */
  missingRequired: string[];
  autoMappedCount: number;
  totalMappableColumns: number;
};

export type MigrationIssueSeverity = "warning" | "error";

export type MigrationIssue = {
  code: string;
  severity: MigrationIssueSeverity;
  /** User-facing sentence. "Unknown currency \"Rs/-\"", not "ERR_CUR_02". */
  message: string;
  field?: string;
  sourceValue?: string;
  /** Deterministic suggestions the UI can offer as one-click resolutions. */
  suggestions?: Array<{ label: string; value: string }>;
};

export type RelationshipCandidate = {
  /** Which IR field wanted a relationship, e.g. "clientId". */
  field: string;
  targetEntity: MigrationEntity;
  /** Identity-cluster key when the match is to another imported record. */
  groupKey: string | null;
  /** Existing workspace record id when the match is to prior data. */
  existingId: string | null;
  label: string;
  confidence: number;
  /** Which signal produced the match, strongest first. */
  evidence: string[];
};

export type DuplicateCandidate = {
  /** "batch" = another row in this migration. "workspace" = existing record. */
  scope: "batch" | "workspace";
  targetId: string | null;
  groupKey: string | null;
  label: string;
  confidence: number;
  evidence: string[];
};

/** What the plan intends to do with a record. Deliberately non-destructive. */
export const RECORD_ACTIONS = ["create", "link", "skip", "review", "merge"] as const;
export type RecordAction = (typeof RECORD_ACTIONS)[number];

export type MigrationRecordStatus = "ready" | "review" | "error" | "skipped";

/**
 * One candidate record. `raw` is never discarded after normalization — it is
 * what makes debugging, rollback, auditing, and re-mapping possible later.
 */
export type MigrationRecordIR = {
  entity: MigrationEntity;
  source: {
    sourceId: string;
    fileName: string;
    sheetName: string | null;
    sourceRow: number;
    /** Stable within a session; also the commit idempotency key. */
    sourceKey: string;
    externalId: string | null;
  };
  raw: Record<string, string>;
  normalized: Record<string, unknown>;
  fieldMappings: Record<string, string>;
  confidence: number;
  warnings: MigrationIssue[];
  errors: MigrationIssue[];
  relationshipCandidates: RelationshipCandidate[];
  resolvedRelationships: Record<string, { groupKey: string | null; existingId: string | null; confidence: number }>;
  duplicateCandidates: DuplicateCandidate[];
  /** Identity cluster this record belongs to (clients only, for now). */
  groupKey: string | null;
  status: MigrationRecordStatus;
  action: RecordAction;
};

export type PlannedOperation = {
  /** Deterministic; identical inputs always produce the same key. */
  operationKey: string;
  sequence: number;
  action: RecordAction;
  entity: MigrationEntity;
  sourceKey: string;
  label: string;
  /** Present for `link`: the existing workspace record being attached to. */
  existingId: string | null;
  reason: string;
  /**
   * Hash of the exact values this operation will write, including resolved
   * relationships. Without it the plan hash would only cover *which* records
   * are created, so a re-mapping that changed a field's value could slip
   * between preview and commit unnoticed.
   */
  payloadHash: string;
};

export type ImportPlanCounts = Record<MigrationEntity, { create: number; link: number; skip: number; review: number }>;

export type ImportPlan = {
  engineVersion: number;
  /** sha256 over the normalized plan body. Commit must quote this back. */
  planHash: string;
  planVersion: number;
  createdAt: string;
  counts: ImportPlanCounts;
  totals: { create: number; link: number; skip: number; review: number; error: number };
  operations: PlannedOperation[];
  /** Records that need a human decision before the plan can be committed. */
  reviewItems: Array<{
    sourceKey: string;
    entity: MigrationEntity;
    label: string;
    kind: "duplicate" | "relationship" | "mapping" | "currency" | "status" | "date" | "validation";
    message: string;
    suggestions: Array<{ label: string; value: string }>;
  }>;
  /** Records that cannot import at all until their source data is fixed. */
  blocked: Array<{ sourceKey: string; entity: MigrationEntity; label: string; message: string }>;
  metrics: {
    autoMappingRate: number;
    relationshipResolutionRate: number;
    duplicateRate: number;
    warningCount: number;
    errorCount: number;
  };
};

/**
 * Server-controlled session states. The client never sets these.
 *
 * `rolled_back` is retained only so historical rows created before rollback
 * was disabled still type-check and display correctly; nothing can transition
 * into it anymore (see TRANSITIONS in state.ts). `abandoned` is its
 * non-destructive replacement for unfinished migrations going forward.
 */
export const MIGRATION_STATES = [
  "created",
  "uploading",
  "queued_analysis",
  "profiling",
  "mapping",
  "review_required",
  "ready",
  "queued_commit",
  "committing",
  "completed",
  "completed_with_issues",
  "failed",
  "abandoned",
  "rolled_back",
] as const;

export type MigrationState = (typeof MIGRATION_STATES)[number];

export function confidenceBand(score: number, high: number, medium: number): ConfidenceBand {
  if (score >= high) return "high";
  if (score >= medium) return "medium";
  return "low";
}
