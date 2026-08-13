import assert from "node:assert/strict";
import test from "node:test";

import { parseCsvText } from "../../src/lib/migration/parse/csv.ts";
import { runPipeline } from "../../src/lib/migration/pipeline.ts";
import { EMPTY_WORKSPACE } from "../../src/lib/migration/workspace.ts";

function source(id, fileName, csv, overrides) {
  return { sourceId: id, table: parseCsvText(csv, { fileName }), overrides };
}

function run(sources, workspace = EMPTY_WORKSPACE, extra = {}) {
  return runPipeline({ sources, workspace, planVersion: 1, ...extra });
}

const CLIENTS_CSV = [
  "client_name,email,phone,company",
  "Acme Technologies Pvt Ltd,contact@acme.com,+91 98765 43210,Acme Technologies",
  "Globex Corporation,hello@globex.com,+91 91234 56780,Globex",
].join("\n");

const PROJECTS_CSV = [
  "project_name,client,deadline,budget,status",
  "Website redesign,ACME,2026-06-01,250000,in progress",
  "Brand refresh,Globex Corporation,2026-07-15,120000,on hold",
].join("\n");

const INVOICES_CSV = [
  "invoice_no,customer,total,currency,issue_date,due_date,status",
  "INV-001,Acme Technologies,75000,INR,2026-04-03,2026-05-03,paid",
  "INV-002,Globex Corporation,42000,INR,2026-04-10,2026-05-10,settled",
].join("\n");

const EXPENSES_CSV = [
  "merchant,amount,expense_date,category,project",
  "Figma,1500,2026-04-02,software,Website redesign",
  "Adobe,2400,2026-04-05,Software,Brand refresh",
].join("\n");

test("reconstructs a complete workspace from four files", () => {
  const result = run([
    source("s1", "clients.csv", CLIENTS_CSV),
    source("s2", "projects.csv", PROJECTS_CSV),
    source("s3", "invoices.csv", INVOICES_CSV),
    source("s4", "expenses.csv", EXPENSES_CSV),
  ]);

  assert.deepEqual(
    result.sources.map((item) => item.classification.classification),
    ["clients", "projects", "invoices", "expenses"],
  );
  assert.deepEqual(result.unclassified, []);
  assert.equal(result.plan.blocked.length, 0);
  assert.equal(result.plan.counts.clients.create, 2);
  assert.equal(result.plan.counts.projects.create, 2);
  assert.equal(result.plan.counts.invoices.create, 2);
  assert.equal(result.plan.counts.expenses.create, 2);
});

test("upload order does not change the outcome", () => {
  const forward = run([
    source("s1", "clients.csv", CLIENTS_CSV),
    source("s2", "projects.csv", PROJECTS_CSV),
    source("s3", "invoices.csv", INVOICES_CSV),
  ]);
  const reversed = run([
    source("s3", "invoices.csv", INVOICES_CSV),
    source("s2", "projects.csv", PROJECTS_CSV),
    source("s1", "clients.csv", CLIENTS_CSV),
  ]);
  assert.equal(forward.plan.planHash, reversed.plan.planHash);
});

test("links an invoice to a client named differently in another file", () => {
  const result = run([
    source("s1", "clients.csv", CLIENTS_CSV),
    source("s3", "invoices.csv", INVOICES_CSV),
  ]);
  const invoice = result.records.find((record) => record.normalized.invoiceNumber === "INV-001");
  // "Acme Technologies" and "Acme Technologies Pvt Ltd" normalize identically.
  assert.ok(invoice.resolvedRelationships.clientId, "invoice should resolve its client");
  assert.equal(result.plan.metrics.relationshipResolutionRate, 1);
});

test("offers a merge for an abbreviated client name rather than deciding", () => {
  const result = run([
    source("s1", "clients.csv", CLIENTS_CSV),
    source("s2", "projects.csv", PROJECTS_CSV),
  ]);
  const project = result.records.find((record) => record.normalized.title === "Website redesign");
  // "ACME" is not deterministically "Acme Technologies Pvt Ltd".
  assert.equal(project.resolvedRelationships.clientId, undefined);
  assert.ok(project.relationshipCandidates.length > 0);
  assert.match(project.relationshipCandidates[0].label, /Acme Technologies/);

  const reviewItem = result.plan.reviewItems.find((item) => item.sourceKey === project.source.sourceKey);
  assert.equal(reviewItem.kind, "relationship");
  assert.match(reviewItem.message, /not sure which client/i);
});

test("a resolved relationship is not also reported as an open question", () => {
  const result = run([
    source("s1", "clients.csv", CLIENTS_CSV),
    source("s3", "invoices.csv", INVOICES_CSV),
  ]);
  const invoice = result.records.find((record) => record.normalized.invoiceNumber === "INV-001");
  assert.ok(invoice.resolvedRelationships.clientId, "the client should resolve");
  assert.deepEqual(
    invoice.relationshipCandidates,
    [],
    "candidates describe a question being asked; a resolved link is not one",
  );
  assert.equal(
    result.plan.reviewItems.filter((item) => item.kind === "relationship").length,
    0,
    "nothing should be queued for review",
  );
});

test("asks about an unresolved client even when the project resolved", () => {
  // An invoice can resolve one relationship and not the other. The unresolved
  // one must still surface.
  const invoices = [
    "invoice_no,customer,project,total,currency,issue_date",
    "INV-070,ACME,Website redesign,1000,INR,2026-04-03",
  ].join("\n");
  const result = run([
    source("s1", "clients.csv", CLIENTS_CSV),
    source("s2", "projects.csv", PROJECTS_CSV),
    source("s3", "invoices.csv", invoices),
  ]);
  const invoice = result.records.find((record) => record.normalized.invoiceNumber === "INV-070");
  assert.ok(invoice.resolvedRelationships.projectId, "the project matches exactly");
  assert.equal(invoice.resolvedRelationships.clientId, undefined, "ACME is not deterministic");
  assert.ok(
    result.plan.reviewItems.some((item) => item.sourceKey === invoice.source.sourceKey && item.kind === "relationship"),
    "the unresolved client must still be asked about",
  );
});

test("maps vendor statuses onto Rive's vocabulary", () => {
  const result = run([source("s3", "invoices.csv", INVOICES_CSV)]);
  const settled = result.records.find((record) => record.normalized.invoiceNumber === "INV-002");
  assert.equal(settled.normalized.status, "paid", '"settled" means paid');

  const projects = run([source("s2", "projects.csv", PROJECTS_CSV)]);
  const onHold = projects.records.find((record) => record.normalized.title === "Brand refresh");
  assert.equal(onHold.normalized.status, "paused", '"on hold" means paused');
  const inProgress = projects.records.find((record) => record.normalized.title === "Website redesign");
  assert.equal(inProgress.normalized.status, "active");
});

test("normalises expense categories case-insensitively", () => {
  const result = run([source("s4", "expenses.csv", EXPENSES_CSV)]);
  assert.deepEqual(
    result.records.map((record) => record.normalized.category),
    ["software", "software"],
  );
});

test("creates clients from invoices when no client file was uploaded", () => {
  const result = run([source("s3", "invoices.csv", INVOICES_CSV)]);
  const derived = result.records.filter((record) => record.entity === "clients");
  assert.equal(derived.length, 2);
  assert.deepEqual(derived.map((record) => record.normalized.name).sort(), ["Acme Technologies", "Globex Corporation"]);
  assert.match(derived[0].warnings[0].message, /created from your invoices/i);
  // Nothing is invented: no email was on the invoice, so none is set.
  assert.equal(derived[0].normalized.email, undefined);
  assert.equal(result.plan.counts.clients.create, 2);
});

test("links to existing workspace clients instead of duplicating them", () => {
  const workspace = {
    ...EMPTY_WORKSPACE,
    defaultCurrency: "INR",
    clients: [
      { id: "existing-1", name: "Acme Technologies Pvt Ltd", email: "contact@acme.com", phone: null, company: null, website: null },
    ],
  };
  const result = run([source("s1", "clients.csv", CLIENTS_CSV)], workspace);
  const acme = result.records.find((record) => record.normalized.email === "contact@acme.com");
  assert.equal(acme.action, "link");
  assert.equal(acme.duplicateCandidates[0].targetId, "existing-1");
  assert.equal(result.plan.counts.clients.create, 1, "only Globex is new");
  assert.equal(result.plan.counts.clients.link, 1);
});

test("collapses the same client appearing in two files", () => {
  const duplicated = [
    "client_name,email",
    "Acme Technologies Pvt Ltd,contact@acme.com",
    "ACME TECHNOLOGIES PRIVATE LIMITED,contact@acme.com",
  ].join("\n");
  const result = run([source("s1", "clients.csv", duplicated)]);
  assert.equal(result.plan.counts.clients.create, 1);
  assert.equal(result.plan.counts.clients.skip, 1);
});

test("skips an invoice whose number already exists in the workspace", () => {
  const workspace = {
    ...EMPTY_WORKSPACE,
    invoices: [{ id: "inv-existing", invoiceNumber: "INV-001", clientId: null, total: 75000, issueDate: "2026-04-03" }],
  };
  const result = run([source("s3", "invoices.csv", INVOICES_CSV)], workspace);
  const skipped = result.records.find((record) => record.normalized.invoiceNumber === "INV-001");
  assert.equal(skipped.action, "skip");
  assert.equal(result.plan.counts.invoices.create, 1);
  assert.ok(!result.plan.operations.some((operation) => operation.label === "Invoice INV-001"));
});

test("blocks rows that cannot become valid records and imports the rest", () => {
  const messy = [
    "invoice_no,customer,total,currency,issue_date",
    "INV-010,Acme,75000,INR,2026-04-03",
    "INV-011,Acme,not-a-number,INR,2026-04-04",
    ",Acme,5000,INR,2026-04-05",
  ].join("\n");
  const result = run([source("s3", "invoices.csv", messy)]);
  assert.equal(result.plan.counts.invoices.create, 1);
  assert.equal(result.plan.blocked.length, 2);
  assert.match(result.plan.blocked[0].message, /amount|number/i);
  assert.equal(result.plan.metrics.errorCount >= 2, true);
});

test("refuses to guess an ambiguous currency and blocks only those rows", () => {
  const dollars = [
    "invoice_no,customer,total,issue_date",
    "INV-020,Acme,$1000,2026-04-03",
  ].join("\n");
  const result = run([source("s3", "invoices.csv", dollars)], { ...EMPTY_WORKSPACE, defaultCurrency: "INR" });
  const invoice = result.records.find((record) => record.entity === "invoices");
  const ambiguous = invoice.warnings.find((warning) => warning.code === "CURRENCY_AMBIGUOUS");
  assert.ok(ambiguous, "the dollar sign must not be resolved silently");
  assert.ok(ambiguous.suggestions.some((suggestion) => suggestion.value === "USD"));
  assert.equal(invoice.status, "error", "an unresolved currency blocks the row");
});

test("falls back through the currency resolution order", () => {
  const noCurrency = ["invoice_no,customer,total,issue_date", "INV-030,Acme,1000,2026-04-03"].join("\n");

  const workspaceDefault = run([source("s3", "invoices.csv", noCurrency)], { ...EMPTY_WORKSPACE, defaultCurrency: "INR" });
  assert.equal(workspaceDefault.records.find((r) => r.entity === "invoices").normalized.currency, "INR");

  const migrationDefault = run(
    [source("s3", "invoices.csv", noCurrency)],
    { ...EMPTY_WORKSPACE, defaultCurrency: "INR" },
    { migrationDefaultCurrency: "EUR" },
  );
  assert.equal(migrationDefault.records.find((r) => r.entity === "invoices").normalized.currency, "EUR");
  assert.equal(migrationDefault.records.find((r) => r.entity === "invoices").normalized.currencySource, "migrationDefault");
});

test("preserves source currency per row without converting", () => {
  const mixed = [
    "invoice_no,customer,total,currency,issue_date",
    "INV-040,Acme,1000,EUR,2026-04-03",
    "INV-041,Globex,75000,INR,2026-04-04",
  ].join("\n");
  const result = run([source("s3", "invoices.csv", mixed)], { ...EMPTY_WORKSPACE, defaultCurrency: "USD" });
  const invoices = result.records.filter((record) => record.entity === "invoices");
  assert.deepEqual(invoices.map((record) => record.normalized.currency).sort(), ["EUR", "INR"]);
  assert.deepEqual(invoices.map((record) => record.normalized.total).sort((a, b) => a - b), [1000, 75000]);
});

test("keeps raw values alongside normalized ones", () => {
  const result = run([source("s3", "invoices.csv", INVOICES_CSV)]);
  const invoice = result.records.find((record) => record.normalized.invoiceNumber === "INV-002");
  assert.equal(invoice.raw.status, "settled", "the original status survives normalization");
  assert.equal(invoice.normalized.status, "paid");
  assert.equal(invoice.source.fileName, "invoices.csv");
  assert.equal(invoice.source.sourceRow, 3, "row number matches the spreadsheet");
});

test("reports sources it cannot classify instead of importing them", () => {
  const result = run([
    source("s1", "clients.csv", CLIENTS_CSV),
    source("s9", "mystery.csv", "alpha,beta\n1,2"),
  ]);
  assert.equal(result.unclassified.length, 1);
  assert.equal(result.unclassified[0].sourceId, "s9");
  assert.equal(result.plan.counts.clients.create, 2, "the good file still imports");
});

test("accepts a user's classification for an unknown source", () => {
  const result = run([
    source("s9", "mystery.csv", "alpha,beta\nAcme,contact@acme.com", { classification: "clients", mappings: { alpha: "name", beta: "email" } }),
  ]);
  assert.equal(result.unclassified.length, 0);
  assert.equal(result.plan.counts.clients.create, 1);
  assert.equal(result.records[0].normalized.name, "Acme");
  assert.equal(result.records[0].normalized.email, "contact@acme.com");
});

test("plan hash changes when a user changes a mapping, and not otherwise", () => {
  const base = run([source("s1", "clients.csv", CLIENTS_CSV)]);
  const again = run([source("s1", "clients.csv", CLIENTS_CSV)]);
  assert.equal(base.plan.planHash, again.plan.planHash, "identical inputs hash identically");

  const changed = run([source("s1", "clients.csv", CLIENTS_CSV, { mappings: { company: null } })]);
  assert.notEqual(base.plan.planHash, changed.plan.planHash);
});

test("reports honest auto-resolution metrics", () => {
  const result = run([
    source("s1", "clients.csv", CLIENTS_CSV),
    source("s3", "invoices.csv", INVOICES_CSV),
  ]);
  assert.ok(result.plan.metrics.autoMappingRate > 0.8, `expected a high auto-mapping rate, got ${result.plan.metrics.autoMappingRate}`);
  assert.equal(result.plan.metrics.relationshipResolutionRate, 1);
  assert.equal(result.plan.metrics.errorCount, 0);
});

test("handles an expenses-only migration", () => {
  const result = run([source("s4", "expenses.csv", EXPENSES_CSV)], { ...EMPTY_WORKSPACE, defaultCurrency: "INR" });
  assert.equal(result.plan.counts.expenses.create, 2);
  assert.equal(result.plan.counts.clients.create, 0);
  assert.equal(result.plan.blocked.length, 0);
});

test("imports negative expenses as positive with a warning", () => {
  const negative = ["merchant,amount,expense_date", "Refund from Figma,-1500,2026-04-02"].join("\n");
  const result = run([source("s4", "expenses.csv", negative)], { ...EMPTY_WORKSPACE, defaultCurrency: "INR" });
  const expense = result.records.find((record) => record.entity === "expenses");
  assert.equal(expense.status, "ready");
  assert.ok(expense.warnings.some((warning) => warning.code === "AMOUNT_NEGATIVE"));
});

test("derives an invoice total from subtotal and tax", () => {
  const withTax = ["invoice_no,customer,subtotal,tax,currency,issue_date", "INV-050,Acme,1000,180,INR,2026-04-03"].join("\n");
  const result = run([source("s3", "invoices.csv", withTax)]);
  const invoice = result.records.find((record) => record.entity === "invoices");
  assert.equal(invoice.normalized.subtotal, 1000);
  assert.equal(invoice.normalized.taxAmount, 180);
  assert.equal(invoice.normalized.total, 1180);
});

test("flags an ambiguous date but still imports the row", () => {
  const ambiguous = ["invoice_no,customer,total,currency,issue_date", "INV-060,Acme,1000,INR,03/04/2026"].join("\n");
  const result = run([source("s3", "invoices.csv", ambiguous)]);
  const invoice = result.records.find((record) => record.entity === "invoices");
  const warning = invoice.warnings.find((item) => item.code === "DATE_AMBIGUOUS");
  assert.ok(warning);
  assert.match(warning.message, /2026-04-03 or 2026-03-04/);
  assert.equal(invoice.status, "ready");

  const reviewItem = result.plan.reviewItems.find((item) => item.kind === "date");
  assert.ok(reviewItem, "an ambiguous date should reach the review list");
});

test("handles an empty file and a headers-only file without failing", () => {
  const result = run([
    source("s1", "clients.csv", CLIENTS_CSV),
    source("s8", "empty.csv", ""),
    source("s9", "headers.csv", "name,email"),
  ]);
  assert.equal(result.unclassified.length, 2);
  assert.equal(result.plan.counts.clients.create, 2);
});
