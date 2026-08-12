import assert from "node:assert/strict";
import test from "node:test";

import { parseCsvText, parseDelimited, sniffDelimiter } from "../../src/lib/migration/parse/csv.ts";
import { detectHeaderRow, dedupeHeaders } from "../../src/lib/migration/parse/table.ts";
import { profileTable } from "../../src/lib/migration/profile.ts";
import { classifySource } from "../../src/lib/migration/classify.ts";

function classify(csv, fileName) {
  const table = parseCsvText(csv, { fileName });
  return { table, result: classifySource(profileTable(table, "s1")) };
}

test("parses quoted fields containing delimiters and newlines", () => {
  const grid = parseDelimited('a,b\n"one, two","line\nbreak"\n', ",");
  assert.deepEqual(grid[1], ["one, two", "line\nbreak"]);
});

test("preserves escaped quotes and empty trailing fields", () => {
  const grid = parseDelimited('a,b,c\n"say ""hi""",,\n', ",");
  assert.deepEqual(grid[1], ['say "hi"', "", ""]);
});

test("sniffs semicolon and tab delimited exports", () => {
  assert.equal(sniffDelimiter("name;email;phone\nA;a@b.com;1\nB;b@b.com;2"), ";");
  assert.equal(sniffDelimiter("name\temail\nA\ta@b.com"), "\t");
  assert.equal(sniffDelimiter("name,email\nA,a@b.com"), ",");
});

test("does not truncate rows", () => {
  const rows = Array.from({ length: 6_000 }, (_, index) => `Client ${index},c${index}@x.com`).join("\n");
  const table = parseCsvText(`name,email\n${rows}`, { fileName: "big.csv" });
  assert.equal(table.rows.length, 6_000);
});

test("skips a title row above the real header", () => {
  const grid = [
    ["Acme Books Export"],
    [],
    ["Invoice No", "Customer", "Total"],
    ["INV-1", "Acme", "100"],
  ];
  assert.equal(detectHeaderRow(grid), 2);
});

test("gives blank and duplicated headers distinct identities", () => {
  assert.deepEqual(dedupeHeaders(["Amount", "", "Amount"]), ["Amount", "Column 2", "Amount (2)"]);
});

test("profiles columns from values rather than headers", () => {
  const table = parseCsvText(
    [
      "ref,when,who",
      "INV-001,2026-04-03,contact@acme.com",
      "INV-002,2026-04-17,hello@globex.com",
      "INV-003,2026-05-01,team@initech.com",
    ].join("\n"),
    { fileName: "mystery.csv" },
  );
  const profile = profileTable(table, "s1");
  const [ref, when, who] = profile.columns;

  assert.equal(ref.inferredType, "identifier");
  assert.equal(when.inferredType, "date");
  assert.equal(who.inferredType, "email");
  assert.equal(who.emailPercentage, 1);
  assert.equal(who.uniquePercentage, 1);
});

test("reports null and unique percentages honestly", () => {
  const table = parseCsvText("status\nPaid\nPaid\nPending\n\nPaid", { fileName: "s.csv" });
  const [status] = profileTable(table, "s1").columns;
  assert.equal(status.rowCount, 4, "blank rows are dropped, not counted as data");
  assert.equal(status.uniqueCount, 2);
  assert.equal(status.inferredType, "categorical");
  assert.deepEqual(status.categoricalValues[0], { value: "Paid", count: 3 });
});

test("classifies invoices from an invoice number beside an amount", () => {
  const { result } = classify(
    ["invoice_no,customer,total,due_date", "INV-001,Acme,75000,2026-05-01"].join("\n"),
    "export.csv",
  );
  assert.equal(result.classification, "invoices");
  assert.equal(result.band, "high");
  assert.match(result.reason, /invoice number/i);
});

test("classifies clients from a name beside an email", () => {
  const { result } = classify(
    ["client_name,email,company,phone", "Acme Technologies,contact@acme.com,Acme,+91 98765 43210"].join("\n"),
    "contacts.csv",
  );
  assert.equal(result.classification, "clients");
  assert.equal(result.band, "high");
});

test("classifies expenses from a vendor beside an amount", () => {
  const { result } = classify(
    ["merchant,amount,expense_date,category", "Figma,1500,2026-04-02,software"].join("\n"),
    "export-2.csv",
  );
  assert.equal(result.classification, "expenses");
  assert.equal(result.band, "high");
});

test("classifies projects from a project name beside a deadline", () => {
  const { result } = classify(
    ["project_name,client,deadline,budget", "Website redesign,Acme,2026-06-01,250000"].join("\n"),
    "work.csv",
  );
  assert.equal(result.classification, "projects");
});

test("does not let a shared customer column make invoices look like clients", () => {
  const { result } = classify(
    ["invoice_number,customer,customer_email,total,due_date", "INV-1,Acme,a@acme.com,1000,2026-05-01"].join("\n"),
    "data.csv",
  );
  assert.equal(result.classification, "invoices");
  assert.notEqual(result.runnerUp?.classification, undefined);
  assert.ok(result.confidence > (result.runnerUp?.confidence ?? 0));
});

test("classifies from the file name when headers are messy", () => {
  const { result } = classify(
    ["Customer,Customer E-mail,Notes", "Acme,a@acme.com,VIP"].join("\n"),
    "clients-2026.csv",
  );
  assert.equal(result.classification, "clients");
});

test("refuses to classify a file with no recognisable columns", () => {
  const { result } = classify(["alpha,beta,gamma", "1,2,3"].join("\n"), "data.csv");
  assert.equal(result.classification, "unknown");
  assert.equal(result.band, "low");
  assert.match(result.reason, /do not clearly match/i);
});

test("reports an empty or headers-only file instead of guessing", () => {
  const headersOnly = classify("name,email", "clients.csv");
  assert.equal(headersOnly.result.classification, "unknown");
  assert.match(headersOnly.result.reason, /no data rows/i);
});
