/** Shapes the migration wizard receives from `/api/migrations`. */

export type MigrationLimits = { maxFiles: number; maxRows: number; maxFileMb: number };

export type MigrationSource = {
  fileId: string;
  sourceId: string | null;
  name: string;
  sheetName: string | null;
  entity: string;
  confidence: number | null;
  reason: string | null;
  rowCount: number;
  headers: string[];
  sample: string[][] | null;
  profile: { columns: Array<{ header: string; inferredType: string; description: string; exampleValues: string[] }> } | null;
  mapping: Array<{
    sourceColumn: string;
    target: string | null;
    confidence: number;
    band: "high" | "medium" | "low";
    status: "AUTO" | "SUGGESTED" | "UNRESOLVED" | "IGNORED" | "MANUAL";
    reason: string;
    candidateMappings: Array<{ target: string; confidence: number; reason: string }>;
  }> | null;
  overrides: Record<string, unknown> | null;
  uploadStatus: "waiting" | "uploading" | "verified" | "parsed" | "queued" | "analyzing" | "failed" | "superseded";
  uploadedAt: string | null;
  uploadError: string | null;
  options: Array<{ value: string; label: string }>;
};

export type ReviewItem = {
  sourceKey: string;
  entity: string;
  label: string;
  kind: "duplicate" | "relationship" | "mapping" | "currency" | "status" | "date" | "validation";
  message: string;
  suggestions: Array<{ label: string; value: string }>;
};

export type BlockedItem = { sourceKey: string; entity: string; label: string; message: string };

export type EntityCounts = Record<string, { create: number; link: number; skip: number; review: number }>;

export type MigrationPlanView = {
  planHash: string;
  counts: EntityCounts;
  totals: { create: number; link: number; skip: number; review: number; error: number };
  metrics: {
    autoMappingRate: number;
    relationshipResolutionRate: number;
    duplicateRate: number;
    warningCount: number;
    errorCount: number;
  };
  reviewItems: ReviewItem[];
  blocked: BlockedItem[];
  operationCount: number;
};

export type MigrationRecordView = {
  sourceKey: string;
  entity: string;
  sourceRow: number;
  status: string;
  action: string;
  confidence: number;
  normalized: Record<string, unknown>;
  raw: Record<string, string>;
  warnings: Array<{ code: string; message: string; field?: string; sourceValue?: string; suggestions?: Array<{ label: string; value: string }> }>;
  errors: Array<{ code: string; message: string; field?: string }>;
  relationshipCandidates: Array<{ label: string; confidence: number; evidence: string[]; existingId: string | null; groupKey: string | null }>;
  duplicateCandidates: Array<{ scope: string; label: string; confidence: number; evidence: string[]; targetId: string | null }>;
  importFile: { name: string; sheetName: string | null } | null;
};

export type MigrationState =
  | "created" | "uploading" | "queued_analysis" | "profiling" | "mapping" | "review_required"
  | "ready" | "queued_commit" | "committing" | "completed" | "completed_with_issues" | "failed" | "abandoned" | "rolled_back";

export type MigrationDetail = {
  migration: {
    id: string;
    state: MigrationState;
    editable: boolean;
    planHash: string | null;
    planVersion: number;
    defaultCurrency: string | null;
    createdAt: string;
    completedAt: string | null;
    rolledBackAt: string | null;
    error: string | null;
    failurePhase: string | null;
    failureCode: string | null;
    attemptCount: number;
  };
  sources: MigrationSource[];
  plan: MigrationPlanView | null;
  records: MigrationRecordView[];
  pagination: { page: number; pageSize: number; total: number };
  summary: Record<string, unknown> | null;
  progress: { phase: string; completed: number; total: number; percent: number; lastHeartbeatAt: string | null };
  canCommit: boolean;
  unresolved: { review: number; invalid: number; total: number };
  excluded: {
    count: number;
    rows: Array<{ sourceKey: string; entity: string; sourceRow: number; errors: unknown[]; warnings: unknown[] }>;
    truncated: boolean;
  };
  recovery: {
    canRetry: boolean;
    canReplaceFiles: boolean;
    appliedCount: number;
    pendingCount: number;
    supportReference: string;
    supportRequested: boolean;
  };
};

export type MigrationHistoryEntry = {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  rolledBackAt: string | null;
  created: number;
  linked: number;
  skipped: number;
  warnings: number;
  files: Array<{ name: string; sheetName: string | null; entity: string; rowCount: number }>;
};

export const ENTITY_LABELS: Record<string, string> = {
  clients: "Clients",
  projects: "Projects",
  invoices: "Invoices",
  expenses: "Expenses",
};

/** Singular label used in sentences about one record. */
export const ENTITY_SINGULAR: Record<string, string> = {
  clients: "client",
  projects: "project",
  invoices: "invoice",
  expenses: "expense",
};
