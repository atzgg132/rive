import assert from "node:assert/strict";
import test from "node:test";

import {
  createZohoProvider,
  ZohoAuthError,
  ZohoRateLimitError,
  ZohoTransientError,
  zohoHttpError,
} from "../../src/lib/migration/adapters/zoho.ts";
import { collectAllPages } from "../../src/lib/migration/adapters/provider.ts";
import { zohoRetryDelays } from "../../src/utils/zohoBooks.ts";

/**
 * Unit tests for the Zoho Books provider adapter: pagination termination
 * (including the hard-cap-even-if-the-provider-never-says-done case), retry
 * error classification, organization listing, and IR conversion.
 */

const provider = createZohoProvider({ pageSize: 2 });

/** A FetchPage that serves canned pages and stops when told to. */
function pagedTransport(pages) {
  const transport = async (path, options) => {
    const page = Number(options?.params?.page || 1);
    transport.calls.push({ path, page: String(page) });
    const index = page - 1;
    if (index >= pages.length) {
      return { code: 0, page_context: { has_more_page: false }, contacts: [] };
    }
    const current = pages[index];
    return {
      code: 0,
      page_context: { page, has_more_page: current.hasMore },
      contacts: current.records,
    };
  };
  transport.calls = [];
  return transport;
}

test("collectAllPages terminates when the provider reports no more pages", async () => {
  const transport = pagedTransport([
    { records: [{ contact_id: "c1", contact_name: "Acme" }], hasMore: true },
    { records: [{ contact_id: "c2", contact_name: "Globex" }], hasMore: false },
  ]);
  const raw = await collectAllPages(provider, transport, "clients");
  assert.equal(raw.length, 2);
  assert.deepEqual(transport.calls.map((call) => call.page), ["1", "2"]);
});

test("collectAllPages hits the hard page cap even when the provider never reports done", async () => {
  const neverDone = async () => ({ code: 0, page_context: { has_more_page: true }, contacts: [{ contact_id: "x" }] });
  let pagesSeen = 0;
  const raw = await collectAllPages(provider, neverDone, "clients", {
    maxPages: 5,
    onPage: () => { pagesSeen += 1; },
  });
  assert.equal(pagesSeen, 5, "the loop must stop at the cap");
  assert.equal(raw.length, 5);
});

test("a Zoho page without has_more_page is treated as the last page", async () => {
  const oneShot = async () => ({ code: 0, contacts: [{ contact_id: "c1", contact_name: "Acme" }] });
  const raw = await collectAllPages(provider, oneShot, "clients", { maxPages: 3 });
  assert.equal(raw.length, 1);
});

test("listOrganizations returns mapped orgs and never auto-selects", async () => {
  const transport = async () => ({
    code: 0,
    organizations: [
      { organization_id: "org-1", name: "Primary", is_default_org: true },
      { organization_id: "org-2", name: "Secondary", is_default_org: false },
    ],
  });
  const orgs = await provider.listOrganizations(transport);
  assert.deepEqual(orgs, [
    { id: "org-1", name: "Primary", currency: null },
    { id: "org-2", name: "Secondary", currency: null },
  ]);
  // The adapter returns both; selection is the caller's decision.
  assert.equal(orgs.length, 2);
});

test("resolveApiDomain rejects anything outside the Zoho allowlist", () => {
  assert.equal(provider.resolveApiDomain({ apiDomain: "https://www.zohoapis.in" }), "https://www.zohoapis.in");
  assert.throws(() => provider.resolveApiDomain({ apiDomain: "https://evil.example.com" }), /not a supported Zoho/);
  assert.throws(() => provider.resolveApiDomain({ apiDomain: "http://www.zohoapis.in" }), /not a supported Zoho/);
  assert.throws(() => provider.resolveApiDomain({ apiDomain: "" }), /not a supported Zoho/);
});

test("classifyError distinguishes auth, rate limit, transient, and permanent failures", () => {
  assert.deepEqual(provider.classifyError(new ZohoAuthError("revoked")), { kind: "auth" });
  assert.deepEqual(provider.classifyError(new ZohoRateLimitError("slow down", 2_000)), {
    kind: "rate_limited",
    retryAfterMs: 2_000,
  });
  assert.deepEqual(provider.classifyError(new ZohoTransientError("boom")), { kind: "transient" });
  const permanent = provider.classifyError(new Error("nope"));
  assert.equal(permanent.kind, "permanent");
});

test("zohoHttpError maps status codes to the right error class", () => {
  assert.ok(zohoHttpError(401) instanceof ZohoAuthError);
  assert.ok(zohoHttpError(403) instanceof ZohoAuthError);
  assert.ok(zohoHttpError(429) instanceof ZohoRateLimitError);
  assert.ok(zohoHttpError(500) instanceof ZohoTransientError);
  assert.ok(zohoHttpError(503) instanceof ZohoTransientError);
  const generic = zohoHttpError(400);
  assert.equal(generic.message, "Zoho Books request failed (400).");
});

test("retry/backoff caps transient retries and honors Retry-After", () => {
  // 429 and 5xx get two bounded retries with the default short delays.
  assert.deepEqual(zohoRetryDelays(429, null), [300, 900]);
  assert.deepEqual(zohoRetryDelays(503, null), [300, 900]);
  assert.deepEqual(zohoRetryDelays(500, null), [300, 900]);
  // Retry-After overrides the delay (bounded to at least 1s, in ms).
  assert.deepEqual(zohoRetryDelays(429, "2"), [2000, 2000]);
  assert.deepEqual(zohoRetryDelays(503, "1"), [1000, 1000]);
  // A non-transient status gets no retries at all — surface immediately.
  assert.deepEqual(zohoRetryDelays(400, null), []);
  assert.deepEqual(zohoRetryDelays(401, null), []);
  assert.deepEqual(zohoRetryDelays(200, null), []);
  // A bogus Retry-After falls back to the default schedule.
  assert.deepEqual(zohoRetryDelays(429, "not-a-number"), [300, 900]);
});

test("toRecordIR maps a contact onto canonical client IR", () => {
  const ir = provider.toRecordIR(
    { contact_id: "c1", contact_name: "Acme Ltd", email: "a@acme.example", status: "active" },
    { sourceId: "zoho-1", sourceRow: 1, defaultCurrency: "USD" },
  );
  assert.equal(ir.entity, "clients");
  assert.equal(ir.source.externalId, "c1");
  assert.equal(ir.source.sourceKey, "zoho-1:clients:c1");
  assert.equal(ir.normalized.name, "Acme Ltd");
  assert.equal(ir.normalized.email, "a@acme.example");
  assert.equal(ir.normalized.status, "active");
});

test("toRecordIR maps a project and keeps the customer reference for resolution", () => {
  const ir = provider.toRecordIR(
    { project_id: "p1", project_name: "Website", customer_id: "c1", customer_name: "Acme Ltd", status: "open" },
    { sourceId: "zoho-1", sourceRow: 1, defaultCurrency: "USD" },
  );
  assert.equal(ir.entity, "projects");
  assert.equal(ir.normalized.title, "Website");
  assert.equal(ir.normalized.clientRef, "Acme Ltd");
  assert.equal(ir.normalized.clientExternalId, "c1");
  // The engine will resolve this against an imported client rather than
  // inventing a duplicate.
  assert.equal(ir.relationshipCandidates.length, 0);
});

test("toRecordIR maps an invoice with amounts and dates", () => {
  const ir = provider.toRecordIR(
    {
      invoice_id: "inv-1",
      invoice_number: "INV-001",
      customer_name: "Acme Ltd",
      total: 100,
      subtotal: 90,
      tax_total: 10,
      currency_code: "INR",
      date: "2026-04-03",
      due_date: "2026-05-03",
      status: "paid",
    },
    { sourceId: "zoho-1", sourceRow: 1, defaultCurrency: "USD" },
  );
  assert.equal(ir.entity, "invoices");
  assert.equal(ir.normalized.invoiceNumber, "INV-001");
  assert.equal(ir.normalized.total, 100);
  assert.equal(ir.normalized.currency, "INR");
  assert.equal(ir.normalized.issueDate, "2026-04-03");
  assert.equal(ir.normalized.status, "paid");
});

test("toRecordIR flags a negative expense as a warning", () => {
  const ir = provider.toRecordIR(
    { expense_id: "e1", description: "Refund", amount: -50, currency_code: "INR", expense_date: "2026-04-03" },
    { sourceId: "zoho-1", sourceRow: 1, defaultCurrency: "USD" },
  );
  assert.equal(ir.entity, "expenses");
  assert.equal(ir.warnings.length, 1);
  assert.equal(ir.warnings[0].code, "EXPENSE_NEGATIVE_AMOUNT");
});

test("fetchPage drives Zoho's page cursor opaquely and stops at has_more_page=false", async () => {
  const transport = pagedTransport([
    { records: [{ contact_id: "c1", contact_name: "A" }], hasMore: true },
    { records: [{ contact_id: "c2", contact_name: "B" }], hasMore: true },
    { records: [{ contact_id: "c3", contact_name: "C" }], hasMore: false },
  ]);
  const pages = [];
  let cursor = null;
  for (let i = 0; i < 5; i += 1) {
    const result = await provider.fetchPage(transport, "clients", cursor);
    pages.push(...result.records);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  assert.equal(pages.length, 3);
  assert.deepEqual(transport.calls.map((call) => call.page), ["1", "2", "3"]);
});
