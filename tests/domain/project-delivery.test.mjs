import assert from "node:assert/strict";
import test from "node:test";

import {
  deliveryStatus,
  groupByDeliveryBucket,
  milestoneProgress,
} from "../../src/utils/projectDelivery.ts";

const NOW = new Date("2026-08-18T09:30:00Z");

test("delivery status separates overdue, imminent, and scheduled deadlines", () => {
  assert.deepEqual(deliveryStatus("2026-08-15T00:00:00Z", "active", NOW), {
    bucket: "overdue",
    tone: "overdue",
    label: "Overdue by 3 days",
  });
  assert.equal(deliveryStatus("2026-08-17T00:00:00Z", "active", NOW).label, "Overdue by 1 day");
  assert.deepEqual(deliveryStatus("2026-08-18T23:00:00Z", "active", NOW), {
    bucket: "this_week",
    tone: "urgent",
    label: "Due today",
  });
  assert.equal(deliveryStatus("2026-08-19T00:00:00Z", "active", NOW).label, "Due tomorrow");
  assert.equal(deliveryStatus("2026-08-25T00:00:00Z", "active", NOW).label, "Due in 7 days");
  assert.deepEqual(deliveryStatus("2026-09-30T00:00:00Z", "active", NOW), {
    bucket: "later",
    tone: "normal",
    label: "Due Sep 30",
  });
});

test("a completed project is never reported as overdue", () => {
  const status = deliveryStatus("2026-08-15T00:00:00Z", "completed", NOW);
  assert.equal(status.tone, "muted");
  assert.equal(status.label, "Due Aug 15");
});

test("a missing or unparseable deadline falls back to the no-deadline bucket", () => {
  for (const value of [null, undefined, "", "not-a-date"]) {
    assert.deepEqual(deliveryStatus(value, "active", NOW), {
      bucket: "no_deadline",
      tone: "muted",
      label: "No deadline",
    });
  }
});

test("grouping keeps sorted order and only merges adjacent runs", () => {
  const rows = [
    { id: "a", due: "2026-08-15T00:00:00Z" },
    { id: "b", due: "2026-08-16T00:00:00Z" },
    { id: "c", due: "2026-08-20T00:00:00Z" },
    { id: "d", due: null },
  ];

  const sections = groupByDeliveryBucket(rows, (row) => deliveryStatus(row.due, "active", NOW));

  assert.deepEqual(
    sections.map((section) => [section.bucket, section.items.map((item) => item.id)]),
    [
      ["overdue", ["a", "b"]],
      ["this_week", ["c"]],
      ["no_deadline", ["d"]],
    ],
  );
});

test("milestone progress clamps to a sane percentage", () => {
  assert.equal(milestoneProgress(0, 0), 0);
  assert.equal(milestoneProgress(3, 0), 0);
  assert.equal(milestoneProgress(3, 9), 33);
  assert.equal(milestoneProgress(12, 9), 100);
  assert.equal(milestoneProgress(-2, 9), 0);
});
