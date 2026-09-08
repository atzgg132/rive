export const WORKSPACE_SEARCH_KINDS = ["client", "project", "invoice", "expense", "agreement"] as const;
export type WorkspaceSearchKind = (typeof WORKSPACE_SEARCH_KINDS)[number];

export const SEARCH_MAX_QUERY_LENGTH = 80;
export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_TOTAL_LIMIT = 30;
// Fetch enough candidates from each entity kind for exact/prefix matches to
// outrank newer contains matches before the global cap is applied. This is
// still a bounded 30 rows per kind, never an unbounded table scan.
export const SEARCH_LIMIT_PER_KIND = SEARCH_TOTAL_LIMIT;

export function normalizeWorkspaceSearchLimit(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(typeof value === "string" ? value : "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, SEARCH_TOTAL_LIMIT) : SEARCH_TOTAL_LIMIT;
}

export type WorkspaceSearchResult = {
  kind: WorkspaceSearchKind;
  type: WorkspaceSearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  href: string;
};

/** Keep search work bounded and make equivalent input produce the same query. */
export function normalizeWorkspaceSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_QUERY_LENGTH)
    .replace(/\s+$/g, "");
  return normalized.length >= SEARCH_MIN_QUERY_LENGTH ? normalized : "";
}

type ContainsFilter = { contains: string; mode: "insensitive" };

function contains(query: string): ContainsFilter {
  return { contains: query, mode: "insensitive" };
}

/**
 * Build the complete owner-scoped predicate for one entity. Keeping this
 * centralized makes it difficult for a new search branch to omit tenant scope.
 */
export function workspaceSearchWhere(kind: WorkspaceSearchKind, userId: string, query: string): Record<string, unknown> {
  const text = contains(query);
  const fields: Record<WorkspaceSearchKind, Array<Record<string, unknown>>> = {
    client: [{ name: text }, { company: text }, { email: text }],
    project: [{ title: text }, { description: text }, { client: { userId, name: text } }],
    invoice: [{ invoiceNumber: text }, { client: { userId, name: text } }, { project: { userId, title: text } }],
    expense: [{ description: text }, { category: text }, { project: { userId, title: text } }],
    agreement: [{ title: text }, { client: { userId, name: text } }, { project: { userId, title: text } }],
  };
  return { userId, OR: fields[kind] };
}

const KIND_ORDER = new Map<WorkspaceSearchKind, number>(WORKSPACE_SEARCH_KINDS.map((kind, index) => [kind, index]));

function matchRank(result: WorkspaceSearchResult, query: string): number {
  const needle = query.toLocaleLowerCase("en");
  if (!needle) return Number.MAX_SAFE_INTEGER;
  const values = [result.title, result.subtitle || ""].map((value) => value.toLocaleLowerCase("en"));
  const exact = values.findIndex((value) => value === needle);
  if (exact >= 0) return exact === 0 ? 0 : 3;
  const prefix = values.findIndex((value) => value.startsWith(needle));
  if (prefix >= 0) return prefix === 0 ? 1 : 4;
  const containsMatch = values.findIndex((value) => value.includes(needle));
  if (containsMatch >= 0) return containsMatch === 0 ? 2 : 5;
  return 6;
}

/** Sort exact, prefix, and contains matches before stable entity/title/ID ties. */
export function sortWorkspaceSearchResults(results: WorkspaceSearchResult[], query = ""): WorkspaceSearchResult[] {
  return [...results].sort((left, right) => {
    const matchOrder = matchRank(left, query) - matchRank(right, query);
    if (matchOrder !== 0) return matchOrder;
    const kindOrder = (KIND_ORDER.get(left.kind) ?? Number.MAX_SAFE_INTEGER) - (KIND_ORDER.get(right.kind) ?? Number.MAX_SAFE_INTEGER);
    if (kindOrder !== 0) return kindOrder;
    const titleOrder = left.title.toLocaleLowerCase("en").localeCompare(right.title.toLocaleLowerCase("en"), "en");
    if (titleOrder !== 0) return titleOrder;
    return left.id.localeCompare(right.id, "en");
  });
}
