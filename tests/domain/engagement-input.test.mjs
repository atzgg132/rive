import assert from "node:assert/strict";
import test from "node:test";
import { EngagementInputError, parseInquiryConversionInput, parseStartEngagementInput } from "../../src/utils/engagements.ts";

const base = {
  flowId: "flow_1234567890abcdef",
  entryPoint: "workspace",
  client: { mode: "new", name: "Acme" },
  project: { title: "Website launch", scope: "Design and build the launch site." },
  milestone: { title: "First design review", dueDate: "2026-09-15" },
  scopeMode: "project",
};

test("parses a scope-only engagement without inventing billing", () => {
  const parsed = parseStartEngagementInput(base);
  assert.equal(parsed.client.mode, "new");
  assert.equal(parsed.scopeMode, "project");
  assert.equal(parsed.invoice, null);
});

test("parses an Agreement plus invoice with a positive decimal amount", () => {
  const parsed = parseStartEngagementInput({
    ...base,
    entryPoint: "onboarding",
    client: { mode: "existing", id: "client_123" },
    scopeMode: "agreement",
    invoice: { amount: "1250.50", dueDate: "2026-09-20" },
  });
  assert.deepEqual(parsed.client, { mode: "existing", id: "client_123" });
  assert.equal(parsed.invoice?.amount, 1250.5);
});

test("rejects malformed dates and non-positive invoice values", () => {
  assert.throws(
    () => parseStartEngagementInput({ ...base, milestone: { ...base.milestone, dueDate: "15/09/2026" } }),
    (error) => error instanceof EngagementInputError && error.code === "invalid_milestone_due_date",
  );
  assert.throws(
    () => parseStartEngagementInput({ ...base, invoice: { amount: "0", dueDate: "2026-09-20" } }),
    (error) => error instanceof EngagementInputError && error.code === "invalid_invoice_amount",
  );
});

test("rejects ambiguous client commands", () => {
  assert.throws(
    () => parseStartEngagementInput({ ...base, client: { mode: "existing", id: "", name: "Acme" } }),
    (error) => error instanceof EngagementInputError && error.code === "missing_client",
  );
});

test("inquiry conversion requires an explicit client choice and preserves the read-only source boundary", () => {
  const parsed = parseInquiryConversionInput({
    client: { mode: "new", name: "  Jane Smith  ", email: "JANE@EXAMPLE.COM" },
  });

  assert.deepEqual(parsed, {
    client: { mode: "new", name: "Jane Smith", email: "jane@example.com" },
  });
  assert.throws(
    () => parseInquiryConversionInput({ client: { mode: "existing", id: "" } }),
    (error) => error instanceof EngagementInputError && error.code === "missing_client",
  );
});

test("inquiry engagement input requires a source and keeps the converted client explicit", () => {
  const parsed = parseStartEngagementInput({
    ...base,
    entryPoint: "inquiry",
    sourceInquiryId: "inquiry_123",
    client: { mode: "existing", id: "client_123" },
  });
  assert.equal(parsed.entryPoint, "inquiry");
  assert.equal(parsed.sourceInquiryId, "inquiry_123");
  assert.throws(
    () => parseStartEngagementInput({
      ...base,
      entryPoint: "inquiry",
      sourceInquiryId: "inquiry_123",
      client: { mode: "existing", id: "client_123" },
      project: { ...base.project, scope: "  " },
    }),
    (error) => error instanceof EngagementInputError && error.code === "missing_project_scope",
  );
  assert.throws(
    () => parseStartEngagementInput({ ...base, entryPoint: "inquiry" }),
    (error) => error instanceof EngagementInputError && error.code === "missing_source_inquiry",
  );
});
