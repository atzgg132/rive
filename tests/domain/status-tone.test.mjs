import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIENT_STATUSES,
  EXPENSE_CATEGORIES,
  INVOICE_STATUSES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
} from "../../src/lib/domain-vocabulary.ts";
import { CONTRACT_STATUSES } from "../../src/utils/contractStatus.ts";
import { statusLabel, statusTone } from "../../src/lib/status-tone.ts";

const TONES = ["success", "warning", "destructive", "info", "violet", "muted", "primary"];

for (const [kind, values] of [
  ["project", PROJECT_STATUSES],
  ["invoice", INVOICE_STATUSES],
  ["contract", CONTRACT_STATUSES],
  ["client", CLIENT_STATUSES],
  ["priority", PROJECT_PRIORITIES],
  ["expense", EXPENSE_CATEGORIES],
]) {
  test(`every ${kind} vocabulary value has a tone and a label`, () => {
    for (const value of values) {
      assert.ok(TONES.includes(statusTone(kind, value)), value);
      assert.equal(typeof statusLabel(kind, value), "string");
      assert.notEqual(statusLabel(kind, value), "");
    }
  });
}

test("pins the canonical chip labels", () => {
  assert.equal(statusLabel("project", "active"), "In progress");
  assert.equal(statusLabel("project", "in_progress"), "In Progress");
  assert.equal(statusLabel("invoice", "partially_paid"), "Partly paid");
  assert.equal(statusLabel("invoice", "paid"), "Paid");
  assert.equal(statusLabel("contract", "ready_to_sign"), "Ready for acceptance");
  assert.equal(statusLabel("contract", "executed"), "Accepted");
  assert.equal(statusLabel("client", "active"), "Active");
  assert.equal(statusLabel("priority", "urgent"), "Urgent");
  assert.equal(statusLabel("expense", "software"), "Software");
});

test("covers every canonical status with its intended tone and label", () => {
  const expected = {
    project: {
      active: ["info", "In progress"],
      paused: ["warning", "Paused"],
      completed: ["success", "Completed"],
      archived: ["muted", "Archived"],
    },
    invoice: {
      draft: ["muted", "Draft"],
      sent: ["info", "Sent"],
      viewed: ["info", "Viewed"],
      partially_paid: ["warning", "Partly paid"],
      paid: ["success", "Paid"],
      overdue: ["destructive", "Overdue"],
      voided: ["muted", "Voided"],
      cancelled: ["muted", "Cancelled"],
    },
    contract: {
      draft: ["muted", "Draft"],
      in_review: ["warning", "In review"],
      ready_to_sign: ["info", "Ready for acceptance"],
      starting: ["info", "Preparing acceptance"],
      signing: ["info", "Acceptance"],
      executed: ["success", "Accepted"],
      declined: ["destructive", "Changes requested"],
      expired: ["warning", "Expired"],
      void: ["destructive", "Void"],
    },
    client: {
      active: ["success", "Active"],
      inactive: ["muted", "Inactive"],
    },
    priority: {
      low: ["info", "Low"],
      medium: ["muted", "Medium"],
      high: ["warning", "High"],
      urgent: ["destructive", "Urgent"],
    },
    expense: {
      software: ["info", "Software"],
      hardware: ["violet", "Hardware"],
      travel: ["warning", "Travel"],
      meals: ["warning", "Meals"],
      office: ["muted", "Office"],
      contractor: ["success", "Contractor"],
      other: ["muted", "Other"],
    },
  };

  for (const [kind, values] of Object.entries(expected)) {
    for (const [value, [tone, label]] of Object.entries(values)) {
      assert.equal(statusTone(kind, value), tone, `${kind}/${value} tone`);
      assert.equal(statusLabel(kind, value), label, `${kind}/${value} label`);
    }
  }
});

test("pins the canonical tones", () => {
  assert.equal(statusTone("project", "active"), "info");
  assert.equal(statusTone("project", "completed"), "success");
  assert.equal(statusTone("invoice", "overdue"), "destructive");
  assert.equal(statusTone("invoice", "partially_paid"), "warning");
  assert.equal(statusTone("contract", "void"), "destructive");
  assert.equal(statusTone("contract", "executed"), "success");
  assert.equal(statusTone("client", "active"), "success");
  assert.equal(statusTone("priority", "urgent"), "destructive");
  assert.equal(statusTone("expense", "hardware"), "violet");
});

test("falls back safely for unknown values", () => {
  assert.equal(statusTone("project", "nope"), "muted");
  assert.equal(statusLabel("invoice", "weird_status"), "weird status");
  assert.equal(statusLabel("project", "weird"), "weird");
});
