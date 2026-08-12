import assert from "node:assert/strict";
import test from "node:test";

import { parseCsvText } from "../../src/lib/migration/parse/csv.ts";
import { profileTable } from "../../src/lib/migration/profile.ts";
import { buildMappingPlan, resolvedFieldMap } from "../../src/lib/migration/mapping.ts";
import { applyProposals, collectUnresolved, deterministicResolver } from "../../src/lib/migration/resolver.ts";
import { MAPPING_THRESHOLDS } from "../../src/lib/migration/config.ts";

function plan(csv, entity, overrides = {}) {
  const table = parseCsvText(csv, { fileName: "source.csv" });
  const profile = profileTable(table, "s1");
  return { profile, plan: buildMappingPlan(profile, entity, null, overrides) };
}

function targetOf(mappingPlan, column) {
  return mappingPlan.mappings.find((mapping) => mapping.sourceColumn === column);
}

test("maps a clean clients export end to end", () => {
  const { plan: result } = plan(
    [
      "client_name,email,phone,company,website",
      "Acme Technologies,contact@acme.com,+91 98765 43210,Acme,https://acme.com",
      "Globex,hello@globex.com,+91 91234 56780,Globex,https://globex.com",
    ].join("\n"),
    "clients",
  );
  assert.equal(targetOf(result, "client_name").target, "name");
  assert.equal(targetOf(result, "email").target, "email");
  assert.equal(targetOf(result, "phone").target, "phone");
  assert.equal(targetOf(result, "website").target, "website");
  assert.deepEqual(result.missingRequired, []);
  assert.equal(targetOf(result, "email").status, "AUTO");
});

test("handles the messy headers a real export produces", () => {
  const { plan: result } = plan(
    [
      "Customer,Customer E-mail,Bill #,Bill Total,Due",
      "Acme Technologies,contact@acme.com,INV-001,75000,2026-05-01",
      "Globex,hello@globex.com,INV-002,42000,2026-05-11",
    ].join("\n"),
    "invoices",
  );
  assert.equal(targetOf(result, "Bill #").target, "invoiceNumber");
  assert.equal(targetOf(result, "Bill Total").target, "total");
  assert.equal(targetOf(result, "Customer").target, "clientRef");
  assert.equal(targetOf(result, "Customer E-mail").target, "clientEmailRef");
  assert.equal(targetOf(result, "Due").target, "dueDate");
});

test("never maps a date column onto an amount field", () => {
  // The header says "amount" but every value is a date.
  const { plan: result } = plan(
    ["amount,description", "2026-04-03,Figma", "2026-04-17,Notion"].join("\n"),
    "expenses",
  );
  const amount = targetOf(result, "amount");
  assert.notEqual(amount.target, "amount", "type veto must beat header similarity");
  assert.ok(result.missingRequired.includes("amount"));
});

test("explains its reasoning in a sentence a user can check", () => {
  const { plan: result } = plan(
    ["customer_email,customer", "contact@acme.com,Acme", "hi@globex.com,Globex"].join("\n"),
    "clients",
  );
  const email = targetOf(result, "customer_email");
  assert.match(email.reason, /Mapped to Client email because/);
  assert.match(email.reason, /100% of values are valid email addresses/);
});

test("leaves genuinely ambiguous columns unresolved instead of guessing", () => {
  const { profile, plan: result } = plan(
    ["ref,notes_field,zzz", "abc,some text here,other value", "def,more text here,another value"].join("\n"),
    "clients",
  );
  const zzz = targetOf(result, "zzz");
  assert.equal(zzz.target, null);
  assert.equal(zzz.status, "UNRESOLVED");
  assert.ok(zzz.confidence < MAPPING_THRESHOLDS.medium);

  const unresolved = collectUnresolved(result, profile);
  assert.ok(unresolved.some((item) => item.sourceColumn === "zzz"));
  assert.ok(unresolved[0].siblingColumns.includes("ref"));
});

test("satisfies a required field before optional ones", () => {
  // `company` is the only name-bearing column; `name` is required for clients.
  const { plan: result } = plan(
    ["company,email", "Acme Technologies Pvt Ltd,contact@acme.com", "Globex Ltd,hi@globex.com"].join("\n"),
    "clients",
  );
  assert.deepEqual(result.missingRequired, [], "required client name must be filled");
  assert.equal(targetOf(result, "company").target, "name");
});

test("distinguishes subtotal, tax and total in the same sheet", () => {
  const { plan: result } = plan(
    [
      "invoice_no,subtotal,tax,total",
      "INV-1,1000,180,1180",
      "INV-2,2000,360,2360",
    ].join("\n"),
    "invoices",
  );
  assert.equal(targetOf(result, "subtotal").target, "subtotal");
  assert.equal(targetOf(result, "tax").target, "taxAmount");
  assert.equal(targetOf(result, "total").target, "total");
});

test("does not assign one canonical field to two columns", () => {
  const { plan: result } = plan(
    ["amount,total,expense_date,merchant", "100,100,2026-04-03,Figma", "200,200,2026-04-04,Slack"].join("\n"),
    "expenses",
  );
  const targets = result.mappings.map((mapping) => mapping.target).filter(Boolean);
  assert.equal(new Set(targets).size, targets.length, "targets must be unique");
});

test("honours a manual override and records it as the user's choice", () => {
  const { plan: result } = plan(
    ["customer,total,invoice_no", "Acme,1000,INV-1"].join("\n"),
    "invoices",
    { customer: "projectRef" },
  );
  const customer = targetOf(result, "customer");
  assert.equal(customer.target, "projectRef");
  assert.equal(customer.status, "MANUAL");
  assert.equal(customer.confidence, 1);
  assert.match(customer.reason, /You mapped this column/);
});

test("honours an explicit ignore", () => {
  const { plan: result } = plan(
    ["customer,total,invoice_no", "Acme,1000,INV-1"].join("\n"),
    "invoices",
    { customer: null },
  );
  assert.equal(targetOf(result, "customer").status, "IGNORED");
  assert.equal(resolvedFieldMap(result).customer, undefined);
});

test("uses cross-column context to read `customer` as a relationship", () => {
  const withContext = plan(
    ["invoice_no,customer,total", "INV-1,Acme,1000", "INV-2,Globex,2000"].join("\n"),
    "invoices",
  ).plan;
  assert.equal(targetOf(withContext, "customer").target, "clientRef");
  assert.ok(targetOf(withContext, "customer").signals.crossColumnContext > 0);
});

test("V1 resolver proposes nothing, so unresolved stays unresolved", async () => {
  const { profile, plan: result } = plan(
    ["zzz,name", "value one,Acme", "value two,Globex"].join("\n"),
    "clients",
  );
  assert.equal(deterministicResolver.isEnabled(), false);
  const proposals = await deterministicResolver.resolve(collectUnresolved(result, profile));
  assert.deepEqual(proposals, []);
  assert.deepEqual(applyProposals(result, proposals), result);
});

test("a resolver proposal is capped below auto-map and lands in review", () => {
  const { plan: result } = plan(
    ["zzz,name", "value one,Acme", "value two,Globex"].join("\n"),
    "clients",
  );
  const applied = applyProposals(result, [
    { sourceColumn: "zzz", target: "notes", confidence: 0.99, reason: "Proposed by a future resolver." },
  ]);
  const zzz = applied.mappings.find((mapping) => mapping.sourceColumn === "zzz");
  assert.equal(zzz.target, "notes");
  assert.equal(zzz.status, "SUGGESTED", "never AUTO");
  assert.ok(zzz.confidence < MAPPING_THRESHOLDS.high);
});

test("a resolver cannot invent a field or steal a claimed one", () => {
  const { plan: result } = plan(
    ["zzz,name,email", "value one,Acme,a@acme.com", "value two,Globex,b@globex.com"].join("\n"),
    "clients",
  );
  const applied = applyProposals(result, [
    { sourceColumn: "zzz", target: "notAField", confidence: 0.9, reason: "bogus" },
  ]);
  assert.equal(applied.mappings.find((m) => m.sourceColumn === "zzz").target, null);

  const stealing = applyProposals(result, [
    { sourceColumn: "zzz", target: "email", confidence: 0.9, reason: "already taken" },
  ]);
  assert.equal(stealing.mappings.find((m) => m.sourceColumn === "zzz").target, null);
});
