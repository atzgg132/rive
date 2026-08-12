import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { parseCsvBytes } from "../../src/lib/migration/parse/csv.ts";
import { parseWorkbook } from "../../src/lib/migration/parse/workbook.ts";
import { runPipeline } from "../../src/lib/migration/pipeline.ts";
import { EMPTY_WORKSPACE } from "../../src/lib/migration/workspace.ts";

/**
 * Integration tests over the fixture files, which are the closest thing to a
 * real migration this suite can run without a database. Every fixture is
 * synthetic.
 */

const FIXTURES = join(process.cwd(), "tests", "fixtures", "migration");
const INR = { ...EMPTY_WORKSPACE, defaultCurrency: "INR" };

function csv(name) {
  const bytes = new Uint8Array(readFileSync(join(FIXTURES, name)));
  return { sourceId: name, table: parseCsvBytes(bytes, { fileName: name }) };
}

function run(sources, workspace = INR, extra = {}) {
  return runPipeline({ sources, workspace, planVersion: 1, ...extra });
}

test("imports the four clean fixtures as a connected workspace", () => {
  const result = run([
    csv("clients-standard.csv"),
    csv("projects-standard.csv"),
    csv("invoices-standard.csv"),
    csv("expenses-standard.csv"),
  ]);

  assert.deepEqual(
    result.sources.map((source) => source.classification.classification),
    ["clients", "projects", "invoices", "expenses"],
  );
  assert.equal(result.plan.counts.clients.create, 3);
  assert.equal(result.plan.counts.projects.create, 3);
  assert.equal(result.plan.counts.invoices.create, 3);
  assert.equal(result.plan.counts.expenses.create, 4);
  assert.equal(result.plan.blocked.length, 0);
  assert.equal(result.plan.metrics.relationshipResolutionRate, 1, "every relationship should resolve");
});

test("reads messy headers without any manual mapping", () => {
  const result = run([csv("clients-weird-headers.csv"), csv("invoices-messy-headers.csv")]);
  const clients = result.records.filter((record) => record.entity === "clients");
  assert.ok(clients.some((record) => record.normalized.email === "contact@acme.example"));
  // "Web Address" holds bare domains; they must still read as a website and be
  // stored with a scheme so the link works.
  assert.ok(
    clients.some((record) => record.normalized.website === "https://acme.example"),
    `expected a website, got ${JSON.stringify(clients.map((record) => record.normalized))}`,
  );

  const invoices = result.records.filter((record) => record.entity === "invoices");
  assert.deepEqual(invoices.map((record) => record.normalized.invoiceNumber).sort(), ["INV-101", "INV-102"]);
  assert.deepEqual(invoices.map((record) => record.normalized.total).sort((a, b) => a - b), [42000, 75000]);
});

test("collapses duplicate clients and keeps one of each", () => {
  const result = run([csv("clients-duplicates.csv")]);
  assert.equal(result.plan.counts.clients.create, 2, "Acme collapses to one; Globex is separate");
  assert.equal(result.plan.counts.clients.skip, 2);
});

test("blocks a nameless client but imports the rest", () => {
  const result = run([csv("clients-missing-email.csv")]);
  assert.equal(result.plan.counts.clients.create, 2);
  assert.equal(result.plan.blocked.length, 1);
  assert.match(result.plan.blocked[0].message, /needs a name/i);

  const invalidEmail = result.records.find((record) => record.normalized.name === "Globex Corporation");
  assert.equal(invalidEmail.normalized.email, undefined, "an invalid email is dropped, not stored");
  assert.ok(invalidEmail.warnings.some((warning) => warning.code === "EMAIL_INVALID"));
});

test("raises a merge question for an abbreviated client and an unknown one", () => {
  const result = run([csv("clients-standard.csv"), csv("projects-unresolved-client.csv")]);
  const acme = result.records.find((record) => record.normalized.title === "Website redesign");
  assert.equal(acme.resolvedRelationships.clientId, undefined);
  assert.ok(acme.relationshipCandidates.length > 0);

  // "Umbrella Holdings" resembles nothing, so it becomes a new client rather
  // than a question with no useful answers.
  const umbrella = result.records.find((record) => record.normalized.name === "Umbrella Holdings");
  assert.ok(umbrella, "an entirely new client should be created from the project");
});

test("keeps each invoice in its own currency and asks about the dollar sign", () => {
  const result = run([csv("invoices-multiple-currencies.csv")]);
  const byNumber = new Map(
    result.records.filter((record) => record.entity === "invoices").map((record) => [record.normalized.invoiceNumber, record]),
  );

  assert.equal(byNumber.get("INV-201").normalized.currency, "INR");
  assert.equal(byNumber.get("INV-202").normalized.currency, "EUR");
  assert.equal(byNumber.get("INV-202").normalized.total, 2500);
  assert.equal(byNumber.get("INV-204").normalized.currency, "INR", "Rs/- resolves to INR");

  const dollars = byNumber.get("INV-203");
  assert.equal(dollars.status, "error", "an ambiguous $ blocks the row rather than guessing");
  assert.ok(dollars.warnings.some((warning) => warning.code === "CURRENCY_AMBIGUOUS"));
});

test("a user's currency answer applies to every row that used the same value", () => {
  const withAnswer = run(
    [{ ...csv("invoices-multiple-currencies.csv"), overrides: { valueMappings: { currency: { $: "SGD" } } } }],
  );
  const resolved = withAnswer.records.find((record) => record.normalized.invoiceNumber === "INV-203");
  assert.equal(resolved.normalized.currency, "SGD");
  assert.equal(resolved.status, "ready");
});

test("maps vendor statuses and refuses to invent one it does not know", () => {
  const result = run([csv("invoices-weird-statuses.csv")]);
  const byNumber = new Map(
    result.records.filter((record) => record.entity === "invoices").map((record) => [record.normalized.invoiceNumber, record]),
  );
  assert.equal(byNumber.get("INV-301").normalized.status, "paid");
  assert.equal(byNumber.get("INV-302").normalized.status, "sent");
  assert.equal(byNumber.get("INV-303").normalized.status, "overdue");

  const unknown = byNumber.get("INV-304");
  assert.equal(unknown.normalized.status, undefined, "an unknown status is left unset");
  const warning = unknown.warnings.find((item) => item.code === "STATUS_UNKNOWN");
  assert.ok(warning);
  assert.ok(warning.suggestions.length > 0, "the review UI needs options to offer");
  assert.equal(unknown.status, "ready", "an unknown status does not block the row");
});

test("settles ambiguous dates from an unambiguous sibling row", () => {
  const result = run([csv("invoices-bad-dates.csv")]);
  const byNumber = new Map(
    result.records.filter((record) => record.entity === "invoices").map((record) => [record.normalized.invoiceNumber, record]),
  );
  // Row 402 has 17/04, which can only be day-first, so 03/04 in row 401 is
  // 3 April rather than 4 March.
  assert.equal(byNumber.get("INV-401").normalized.issueDate, "2026-04-03");
  assert.equal(byNumber.get("INV-402").normalized.issueDate, "2026-04-17");
  assert.ok(!byNumber.get("INV-401").warnings.some((warning) => warning.code === "DATE_AMBIGUOUS"));

  assert.ok(byNumber.get("INV-403").warnings.some((warning) => warning.code === "DATE_UNREADABLE"));
  assert.ok(byNumber.get("INV-404").warnings.some((warning) => warning.code === "DATE_ORDER"));
});

test("separates rows that cannot import from rows that can", () => {
  const result = run([csv("invoices-invalid.csv")]);
  assert.equal(result.plan.counts.invoices.create, 1);
  assert.equal(result.plan.blocked.length, 3);
  const messages = result.plan.blocked.map((item) => item.message).join(" ");
  assert.match(messages, /amount Rive can read/i);
  assert.match(messages, /needs a number/i);
  assert.match(messages, /cannot be negative/i);
});

test("imports negative and zero expenses with the right warnings", () => {
  const result = run([csv("expenses-negative-values.csv")]);
  const expenses = result.records.filter((record) => record.entity === "expenses");
  assert.equal(expenses.length, 3);
  assert.equal(result.plan.blocked.length, 0);
  assert.ok(expenses[0].warnings.some((warning) => warning.code === "AMOUNT_NEGATIVE"));
  assert.ok(expenses.some((record) => record.warnings.some((warning) => warning.code === "AMOUNT_ZERO")));
});

test("raises identical expenses for review rather than skipping them", () => {
  const result = run([csv("expenses-duplicates.csv")]);
  const reviewed = result.records.filter((record) => record.entity === "expenses" && record.action === "review");
  assert.equal(reviewed.length, 1, "same day, same amount, same merchant");
  // The third row is the same expense a month later, which is not a duplicate.
  assert.equal(result.plan.counts.expenses.create, 3);
});

test("reads a semicolon-delimited export", () => {
  const result = run([csv("clients-semicolon.csv")]);
  assert.equal(result.sources[0].classification.classification, "clients");
  assert.equal(result.plan.counts.clients.create, 2);
});

test("reports empty, headers-only, and unrecognisable files without failing", () => {
  const result = run([csv("clients-standard.csv"), csv("empty.csv"), csv("headers-only.csv"), csv("unknown-shape.csv")]);
  assert.equal(result.unclassified.length, 3);
  assert.equal(result.plan.counts.clients.create, 3, "the good file still imports");
});

test("uploading the same file twice changes nothing", () => {
  const once = run([csv("clients-standard.csv")]);
  const twice = run([csv("clients-standard.csv"), { ...csv("clients-standard.csv"), sourceId: "clients-standard.csv" }]);
  assert.equal(twice.plan.counts.clients.create, once.plan.counts.clients.create);
});

test("reads every sheet of a workbook and classifies each one", async () => {
  const bytes = new Uint8Array(readFileSync(join(FIXTURES, "multi-sheet.xlsx")));
  const { tables } = await parseWorkbook(bytes, "multi-sheet.xlsx");
  assert.deepEqual(tables.map((table) => table.sheetName), ["Clients", "Projects", "Invoices", "Expenses"]);

  const result = run(tables.map((table, index) => ({ sourceId: `sheet-${index}`, table })));
  assert.deepEqual(
    result.sources.map((source) => source.classification.classification),
    ["clients", "projects", "invoices", "expenses"],
  );
  assert.equal(result.plan.counts.clients.create, 2);
  assert.equal(result.plan.counts.projects.create, 2);
  assert.equal(result.plan.counts.invoices.create, 2);
  assert.equal(result.plan.counts.expenses.create, 2);
  assert.equal(result.plan.blocked.length, 0);
  assert.equal(result.plan.metrics.relationshipResolutionRate, 1);
});

test("skips a title row above the real header in a workbook", async () => {
  const bytes = new Uint8Array(readFileSync(join(FIXTURES, "mixed-entities.xlsx")));
  const { tables } = await parseWorkbook(bytes, "mixed-entities.xlsx");
  const sheet2 = tables.find((table) => table.sheetName === "Sheet2");
  assert.deepEqual(sheet2.headers, ["invoice_no", "customer", "total", "currency", "issue_date"]);
  assert.equal(sheet2.rows.length, 1);

  const result = run([{ sourceId: "sheet2", table: sheet2 }]);
  assert.equal(result.sources[0].classification.classification, "invoices");
  assert.equal(result.plan.counts.invoices.create, 1);
});

test("asks for confirmation on a sheet whose columns fit two record types", async () => {
  const bytes = new Uint8Array(readFileSync(join(FIXTURES, "mixed-entities.xlsx")));
  const { tables } = await parseWorkbook(bytes, "mixed-entities.xlsx");
  const ledger = tables.find((table) => table.sheetName === "Ledger");
  const result = run([{ sourceId: "ledger", table: ledger }]);

  // `name, email, amount, date` reads most like clients, but not confidently:
  // the records are still built so the user sees a real preview, and the
  // classification is surfaced for confirmation rather than accepted silently.
  assert.notEqual(result.sources[0].classification.band, "high");
  assert.equal(result.needsConfirmation.length, 1);
  assert.equal(result.needsConfirmation[0].sourceId, "ledger");
  assert.ok(result.records.length > 0, "a preview is still produced");
});

test("a confident classification is not queued for confirmation", () => {
  const result = run([csv("clients-standard.csv"), csv("invoices-standard.csv")]);
  assert.equal(result.needsConfirmation.length, 0);
  assert.equal(result.unclassified.length, 0);
});

test("the user's own classification is never second-guessed", async () => {
  const bytes = new Uint8Array(readFileSync(join(FIXTURES, "mixed-entities.xlsx")));
  const { tables } = await parseWorkbook(bytes, "mixed-entities.xlsx");
  const ledger = tables.find((table) => table.sheetName === "Ledger");
  const result = run([{ sourceId: "ledger", table: ledger, overrides: { classification: "clients" } }]);
  assert.equal(result.needsConfirmation.length, 0);
  assert.equal(result.sources[0].classification.confidence, 1);
});

test("plan hash is stable across runs and changes when a decision changes", () => {
  const sources = [csv("clients-standard.csv"), csv("invoices-standard.csv")];
  assert.equal(run(sources).plan.planHash, run(sources).plan.planHash);

  const withDecision = run(sources, INR, {
    resolutions: { [run(sources).records[0].source.sourceKey]: { decision: "skip" } },
  });
  assert.notEqual(run(sources).plan.planHash, withDecision.plan.planHash);
});
