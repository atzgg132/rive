import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { BILLABLE_OCCURRENCE_STATUSES, dueTriggerWhere } from "../../src/utils/contractBilling.ts";
import { acceptedBillingOccurrence } from "../../src/utils/projectGeneration.ts";
import { voidBillingMessage } from "../../src/utils/agreementVoid.ts";
import { engagementPaymentDueDays } from "../../src/utils/engagements.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const contractBilling = await source("src/utils/contractBilling.ts");
const acceptance = await source("src/utils/agreementAcceptance.ts");
const engagements = await source("src/utils/engagements.ts");
const milestoneRoute = await source("src/app/api/workflow/milestones/[id]/route.ts");

/** Evaluate the Prisma where-shape from dueTriggerWhere against a plain item. */
function matches(where, item) {
  return where.OR.some((clause) => Object.entries(clause).every(([key, condition]) => {
    if (key === "milestone") {
      if (!item.milestone) return false;
      return Object.entries(condition).every(([field, expected]) => {
        if (expected && typeof expected === "object" && "lte" in expected) return item.milestone[field] !== null && item.milestone[field] <= expected.lte;
        return item.milestone[field] === expected;
      });
    }
    if (condition && typeof condition === "object" && "lte" in condition) return item[key] !== null && item[key] <= condition.lte;
    return item[key] === condition;
  }));
}

test("acceptance activates billing: occurrences start pending, not parked behind work setup", () => {
  const executedAt = new Date("2026-09-24T10:00:00.000Z");
  assert.deepEqual(acceptedBillingOccurrence(executedAt, { triggerType: "on_signing", triggerDate: null }), { status: "pending", eligibleAt: executedAt });
  assert.equal(acceptedBillingOccurrence(executedAt, { triggerType: "milestone_completed", triggerDate: null }).status, "pending");
});

test("legacy awaiting_work_setup occurrences are still billable", () => {
  assert.deepEqual([...BILLABLE_OCCURRENCE_STATUSES].sort(), ["awaiting_work_setup", "eligible", "pending"]);
});

test("the due-trigger query selects only triggers that are due now", () => {
  const now = new Date("2026-09-24T12:00:00.000Z");
  const past = new Date("2026-09-20T00:00:00.000Z");
  const future = new Date("2026-10-20T00:00:00.000Z");
  const where = dueTriggerWhere(now);
  const due = (item) => matches(where, { triggerDate: null, milestone: null, ...item });
  assert.equal(due({ triggerType: "on_signing" }), true);
  assert.equal(due({ triggerType: "fixed_date", triggerDate: past }), true);
  assert.equal(due({ triggerType: "fixed_date", triggerDate: future }), false);
  assert.equal(due({ triggerType: "milestone_due", triggerDate: past }), true);
  assert.equal(due({ triggerType: "milestone_due", triggerDate: future }), false);
  assert.equal(due({ triggerType: "milestone_due", milestone: { dueDate: past, completed: false } }), true);
  assert.equal(due({ triggerType: "milestone_completed", milestone: { dueDate: future, completed: true } }), true);
  assert.equal(due({ triggerType: "milestone_completed", milestone: { dueDate: past, completed: false } }), false);
});

test("the billing worker filters due triggers before the batch limit and uses the owner's invoice prefix", () => {
  const query = contractBilling.slice(contractBilling.indexOf("contractBillingOccurrence.findMany"));
  assert.ok(query.indexOf("paymentPlanItem: dueTriggerWhere(now)") < query.indexOf("take:"));
  assert.match(contractBilling, /invoiceProfile\?\.invoicePrefix \|\| "INV"/);
  assert.doesNotMatch(contractBilling, /"RIVE"/);
});

test("acceptance drafts already-due invoices straight away, without failing the acceptance", () => {
  assert.match(acceptance, /await processContractBilling\(\{ userId: contract\.userId, contractId: contract\.id[\s\S]*?\}\)\.catch\(/);
});

test("the milestone message only claims a draft when one was created", () => {
  assert.doesNotMatch(milestoneRoute, /Any eligible contract invoice has been prepared/);
  assert.match(milestoneRoute, /drafted > 0/);
});

test("a void summary names cancelled drafts and cancelled triggers", () => {
  assert.equal(voidBillingMessage("X", { cancelledTriggers: 0, cancelledDrafts: [] }), null);
  const message = voidBillingMessage("Site build", { cancelledTriggers: 2, cancelledDrafts: [{ id: "i1", invoiceNumber: "INV-2026-0004" }] });
  assert.match(message, /INV-2026-0004 was cancelled/);
  assert.match(message, /2 upcoming invoices will not be drafted/);
  assert.match(message, /Invoices already sent are unchanged/);
});

test("engagement first payment due days are clamped to the plan limits", () => {
  const now = new Date("2026-09-24T12:00:00.000Z");
  assert.equal(engagementPaymentDueDays(new Date("2026-10-01T12:00:00.000Z"), now), 7);
  assert.equal(engagementPaymentDueDays(new Date("2026-09-01T12:00:00.000Z"), now), 0);
  assert.equal(engagementPaymentDueDays(new Date("2029-01-01T12:00:00.000Z"), now), 365);
});

test("agreement-mode engagements put the first payment in the Agreement instead of a separate invoice", () => {
  assert.match(engagements, /triggerType: "on_signing"/);
  assert.match(engagements, /if \(input\.invoice && expectsStandaloneInvoice\(input\)\)/);
});
