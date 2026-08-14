/**
 * Provider-adapter seam for live-source imports (Zoho Books, and later
 * QuickBooks/Xero).
 *
 * This is deliberately NOT the file-based `SourceAdapter` in `./types.ts`.
 * That seam assumes parsed rows are already in hand (a CSV/XLSX export). A
 * provider serves rows over an API, so it needs a different contract:
 *
 *   - the CALLER drives pagination via an opaque cursor (never the adapter),
 *     so a runaway loop stays the caller's responsibility and the resumable
 *     checkpoint (`ConnectorConnection.syncCursor`) is the caller's to write;
 *   - organizations are listed, never auto-selected — the user picks, and
 *     `sync` refuses to run until `organizationId` is set;
 *   - region resolution goes through an allowlist, not a free-form URL;
 *   - the adapter only ever produces canonical migration IR — it can never
 *     reach the database, exactly like the file pipeline.
 *
 * A provider adapter must be pure (no I/O of its own beyond the fetch the
 * caller hands it) so it can be unit-tested without a network or a database.
 */

import type { MigrationEntity, MigrationRecordIR } from "../types.ts";

/** One page of provider records and the cursor for the next page. */
export type ProviderPage<T> = {
  records: T[];
  /** Opaque cursor for the next page; null means "no more pages". */
  nextCursor: string | null;
};

/**
 * The minimal surface a provider must implement. Kept small on purpose: the
 * more an adapter does, the more it can get wrong, and the more it cannot be
 * shared between providers.
 */
export type ProviderAdapter<T> = {
  providerId: string;

  /**
   * Resolve the region-specific API base from stored credentials.
   *
   * Implementations MUST reject anything outside their allowlist rather than
   * falling back to a default silently — a stored `apiDomain` pointing at an
   * attacker-controlled host must fail closed, not quietly use zoho.com.
   */
  resolveApiDomain: (credentials: { apiDomain?: string | null }) => string;

  /** List selectable organizations. Never auto-selects. */
  listOrganizations: (fetchPage: FetchPage) => Promise<Array<{ id: string; name: string; currency?: string | null }>>;

  /**
   * Fetch one page of records of `entity`, continuing from `cursor`.
   *
   * The cursor is opaque to the caller; only the adapter understands it. The
   * caller passes back whatever the previous page returned.
   */
  fetchPage: (
    fetchPage: FetchPage,
    entity: MigrationEntity,
    cursor: string | null,
  ) => Promise<ProviderPage<T>>;

  /** Turn one raw provider record into canonical migration IR. */
  toRecordIR: (raw: T, options: { sourceId: string; sourceRow: number; defaultCurrency: string }) => MigrationRecordIR;

  /** Classify an HTTP/API error so the caller can respond consistently. */
  classifyError: (error: unknown) => ProviderError;
};

/** The single network capability an adapter may use. */
export type FetchPage = (
  path: string,
  options?: { params?: Record<string, string>; retry?: boolean },
) => Promise<unknown>;

export type ProviderError =
  | { kind: "auth" } // 401/403 — credentials revoked, reconnect required
  | { kind: "rate_limited"; retryAfterMs?: number }
  | { kind: "transient" } // 429/5xx — safe to retry with backoff
  | { kind: "not_found" }
  | { kind: "permanent"; message: string }; // everything else

/**
 * Run `fetchPage` over an entire entity with a hard cap, so even a provider
 * that never reports "no more pages" cannot hang the caller.
 */
export async function collectAllPages<T>(
  adapter: Pick<ProviderAdapter<T>, "fetchPage" | "classifyError">,
  fetchPage: FetchPage,
  entity: MigrationEntity,
  options: { maxPages?: number; onPage?: (page: number) => void } = {},
): Promise<T[]> {
  const maxPages = options.maxPages ?? 100;
  const collected: T[] = [];
  let cursor: string | null = null;

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await adapter.fetchPage(fetchPage, entity, cursor);
    collected.push(...result.records);
    options.onPage?.(page);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return collected;
}
