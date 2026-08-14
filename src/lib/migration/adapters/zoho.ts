/**
 * Zoho Books provider adapter — implements the provider-adapter seam in
 * `adapters/provider.ts` against Zoho's Books v3 API.
 *
 * Pure: it takes a `FetchPage` transport (which the server layer wires to the
 * real Zoho HTTP client) so pagination, retry, organization listing, and IR
 * conversion can all be unit-tested without a network or a database.
 *
 * The six read-only scopes used during OAuth are the contract for what this
 * adapter may touch. It only reads; it never writes to Zoho or to Rive's own
 * database.
 */

import { companyComparisonForm } from "@/lib/migration/normalize/text";
import type { MigrationEntity, MigrationRecordIR } from "@/lib/migration/types";
import {
  collectAllPages,
  type FetchPage,
  type ProviderAdapter,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./provider.ts";

/** Zoho data-centre hosts the adapter may talk to. Everything else fails. */
export const ZOHO_API_HOSTS = new Set([
  "www.zohoapis.com",
  "www.zohoapis.in",
  "www.zohoapis.eu",
  "www.zohoapis.com.au",
  "www.zohoapis.jp",
  "www.zohoapis.ca",
  "www.zohoapis.com.cn",
  "www.zohoapis.sa",
]);

export type ZohoOrganization = {
  organization_id: string;
  name: string;
  currency_code?: string;
  time_zone?: string;
  is_default_org?: boolean;
};

export type ZohoContact = {
  contact_id: string;
  contact_name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  website?: string;
  billing_address?: { address?: string };
  status?: "active" | "inactive";
};

export type ZohoProject = {
  project_id: string;
  project_name: string;
  customer_id?: string;
  customer_name?: string;
  description?: string;
  status?: string;
  billing_type?: string;
};

export type ZohoInvoice = {
  invoice_id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  total?: number;
  subtotal?: number;
  tax_total?: number;
  currency_code?: string;
  date?: string;
  due_date?: string;
  status?: string;
};

export type ZohoExpense = {
  expense_id: string;
  description?: string;
  amount?: number;
  currency_code?: string;
  expense_date?: string;
  customer_id?: string;
  customer_name?: string;
  project_id?: string;
  project_name?: string;
  account_name?: string;
  category?: string;
  paid_through_account_name?: string;
};

export type ZohoRecord = ZohoContact | ZohoProject | ZohoInvoice | ZohoExpense;

/** Zoho's page_context: `has_more_page` drives the pagination loop. */
type ZohoPageResponse<T> = {
  code?: number;
  message?: string;
  page_context?: { page?: number; has_more_page?: boolean; report_name?: string };
} & Partial<Record<string, T[]>>;

const STATUS_MAP: Record<string, string> = {
  active: "active",
  inactive: "inactive",
  draft: "draft",
  sent: "sent",
  viewed: "sent",
  paid: "paid",
  partially_paid: "paid",
  overdue: "overdue",
  void: "cancelled",
  cancelled: "cancelled",
  open: "open",
  completed: "completed",
  in_progress: "active",
  stopped: "inactive",
  closed: "completed",
};

/** Zoho statuses use snake_case and their own vocabulary; map onto Rive's. */
function mapStatus(value: string | undefined): string {
  if (!value) return "active";
  const normalized = value.trim().toLowerCase().replace(/[- ]/g, "_");
  return STATUS_MAP[normalized] || "active";
}

/** Convert Zoho's ISO-ish date into the engine's UTC-midnight date-only form. */
function zohoDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function createZohoProvider(options?: {
  /** Override the page size; Zoho caps at 200. */
  pageSize?: number;
}): ProviderAdapter<ZohoRecord> {
  const pageSize = options?.pageSize ?? 200;

  return {
    providerId: "zoho_books",

    resolveApiDomain(credentials) {
      const raw = credentials.apiDomain || "";
      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        throw new Error("Zoho API domain is not a supported Zoho data-centre endpoint.");
      }
      if (parsed.protocol !== "https:" || !ZOHO_API_HOSTS.has(parsed.hostname)) {
        throw new Error("Zoho API domain is not a supported Zoho data-centre endpoint.");
      }
      return parsed.origin;
    },

    async listOrganizations(fetchPage) {
      const payload = (await fetchPage("organizations", { retry: true })) as ZohoPageResponse<ZohoOrganization>;
      if (payload.code && payload.code !== 0) {
        throw new Error(payload.message || "Zoho Books could not list organizations.");
      }
      return (payload.organizations || []).map((organization) => ({
        id: organization.organization_id,
        name: organization.name,
        currency: organization.currency_code || null,
      }));
    },

    async fetchPage(fetchPage, entity, cursor) {
      const path = entityPath(entity);
      // The page cursor is Zoho's 1-based page number, carried opaquely by the
      // caller. We re-encode it so a stale cursor can never be confused with a
      // live one.
      const page = cursor ? Number.parseInt(cursor, 10) || 1 : 1;
      const params: Record<string, string> = { page: String(page), per_page: String(pageSize) };
      if (entity === "expenses") {
        params.page_size = String(pageSize);
      }
      const payload = (await fetchPage(path, { params, retry: true })) as ZohoPageResponse<ZohoRecord>;

      if (payload.code && payload.code !== 0) {
        throw new Error(payload.message || `Zoho Books ${entity} request failed.`);
      }
      // Zoho returns the records under the endpoint's resource name
      // (e.g. "contacts" for /contacts), not the canonical entity name.
      const resourceKey = responseKeyFor(entity);
      const records = payload[resourceKey] || [];
      const hasMore = Boolean(payload.page_context?.has_more_page);
      return {
        records: records as ZohoRecord[],
        nextCursor: hasMore ? String((payload.page_context?.page || page) + 1) : null,
      };
    },

    toRecordIR(raw, { sourceId, sourceRow, defaultCurrency }) {
      const record = raw as ZohoRecord;
      const entity = entityOf(record);
      const externalId = externalIdOf(record);
      const sourceKey = `${sourceId}:${entity}:${externalId || sourceRow}`;
      const normalized = normalizeRecord(record, defaultCurrency);
      const warnings = [];
      if (entity === "expenses" && toNumber((record as ZohoExpense).amount) !== null && toNumber((record as ZohoExpense).amount)! < 0) {
        warnings.push({
          code: "EXPENSE_NEGATIVE_AMOUNT",
          severity: "warning" as const,
          message: `Expense amount is negative (${(record as ZohoExpense).amount}); it will be imported as a positive amount.`,
        });
      }

      return {
        entity,
        source: {
          sourceId,
          fileName: "Zoho Books",
          sheetName: null,
          sourceRow,
          sourceKey,
          externalId,
        },
        raw: raw as unknown as Record<string, string>,
        normalized,
        fieldMappings: {},
        confidence: 1,
        warnings,
        errors: [],
        relationshipCandidates: [],
        resolvedRelationships: {},
        duplicateCandidates: [],
        groupKey: null,
        status: "ready",
        action: "create",
      };
    },

    classifyError(error) {
      if (error instanceof ZohoAuthError) return { kind: "auth" };
      if (error instanceof ZohoRateLimitError) {
        return { kind: "rate_limited", retryAfterMs: error.retryAfterMs };
      }
      if (error instanceof ZohoTransientError) return { kind: "transient" };
      return { kind: "permanent", message: error instanceof Error ? error.message : "Zoho Books request failed." };
    },
  };
}

/** Entity names Zoho returns for each Books list endpoint. */
function entityPath(entity: MigrationEntity): string {
  switch (entity) {
    case "clients": return "contacts";
    case "projects": return "projects";
    case "invoices": return "invoices";
    case "expenses": return "expenses";
  }
}

/** The JSON key Zoho uses for each resource's records. */
function responseKeyFor(entity: MigrationEntity): string {
  switch (entity) {
    case "clients": return "contacts";
    case "projects": return "projects";
    case "invoices": return "invoices";
    case "expenses": return "expenses";
  }
}

function entityOf(record: ZohoRecord): MigrationEntity {
  if ("contact_id" in record) return "clients";
  if ("project_id" in record) return "projects";
  if ("invoice_id" in record) return "invoices";
  return "expenses";
}

function externalIdOf(record: ZohoRecord): string | null {
  if ("contact_id" in record) return (record as ZohoContact).contact_id;
  if ("project_id" in record && !("expense_id" in record)) return (record as ZohoProject).project_id;
  if ("invoice_id" in record) return (record as ZohoInvoice).invoice_id;
  if ("expense_id" in record) return (record as ZohoExpense).expense_id;
  return null;
}

function normalizeRecord(record: ZohoRecord, defaultCurrency: string): Record<string, unknown> {
  if ("contact_id" in record) {
    const contact = record as ZohoContact;
    return {
      name: contact.contact_name,
      email: contact.email || null,
      phone: contact.phone || null,
      company: contact.company_name || null,
      website: contact.website || null,
      address: contact.billing_address?.address || null,
      status: mapStatus(contact.status),
    };
  }
  if ("project_id" in record && !("expense_id" in record)) {
    const project = record as ZohoProject;
    return {
      title: project.project_name,
      description: project.description || null,
      status: mapStatus(project.status),
      clientRef: project.customer_name || null,
      clientExternalId: project.customer_id || null,
    };
  }
  if ("invoice_id" in record) {
    const invoice = record as ZohoInvoice;
    const total = toNumber(invoice.total);
    const subtotal = toNumber(invoice.subtotal);
    const tax = toNumber(invoice.tax_total);
    return {
      invoiceNumber: invoice.invoice_number,
      clientRef: invoice.customer_name || null,
      clientExternalId: invoice.customer_id || null,
      subtotal: subtotal ?? total ?? 0,
      taxRate: 0,
      taxAmount: tax ?? 0,
      total: total ?? subtotal ?? 0,
      currency: invoice.currency_code || defaultCurrency,
      issueDate: zohoDate(invoice.date),
      dueDate: zohoDate(invoice.due_date),
      status: mapStatus(invoice.status),
    };
  }
  const expense = record as ZohoExpense;
  return {
    description: expense.description || null,
    amount: toNumber(expense.amount) ?? 0,
    currency: expense.currency_code || defaultCurrency,
    date: zohoDate(expense.expense_date),
    category: expense.account_name || expense.category || "other",
    clientRef: expense.customer_name || null,
    projectRef: expense.project_name || null,
  };
}

/** Wrap a Zoho HTTP response into a classifiable error. */
export function zohoHttpError(status: number, retryAfterMs?: number): Error {
  if (status === 401 || status === 403) return new ZohoAuthError("Zoho authorization was revoked.");
  if (status === 429) return new ZohoRateLimitError("Zoho is rate limiting requests.", retryAfterMs);
  if (status >= 500) return new ZohoTransientError(`Zoho returned a server error (${status}).`);
  if (status === 404) return new ZohoNotFoundError("Zoho returned not found.");
  return new Error(`Zoho Books request failed (${status}).`);
}

export class ZohoAuthError extends Error {}
export class ZohoRateLimitError extends Error {
  retryAfterMs: number | undefined;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}
export class ZohoTransientError extends Error {}
export class ZohoNotFoundError extends Error {}

/**
 * Convert a full Zoho entity into migration IR for a migration's review stage.
 *
 * This is the entry point a sync route calls once the user has confirmed an
 * organization: it paginates the whole entity (with the hard page cap), maps
 * each record through `toRecordIR`, and returns the IR list the Migration
 * Engine can persist for review and commit.
 */
export async function fetchZohoEntityToIR(
  adapter: ProviderAdapter<ZohoRecord>,
  fetchPage: FetchPage,
  entity: MigrationEntity,
  options: { maxPages?: number; defaultCurrency: string },
): Promise<{ records: MigrationRecordIR[]; pagesFetched: number }> {
  const raw = await collectAllPages(adapter, fetchPage, entity, {
    maxPages: options.maxPages,
  });
  return {
    records: raw.map((record, index) =>
      adapter.toRecordIR(record, { sourceId: "zoho-books", sourceRow: index + 1, defaultCurrency: options.defaultCurrency }),
    ),
    pagesFetched: Math.ceil(raw.length / 200),
  };
}

// Re-exported for the provider seam's consumers.
export { companyComparisonForm };
