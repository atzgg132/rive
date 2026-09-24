import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { prisma } from "../helpers/prisma-mock.mjs";
import {
  addDaysToDateOnly,
  dateOnlyInTimeZone,
  isInvoiceEligibleForReminders,
  sanitizeReminderSchedule,
  selectDueReminderStep,
} from "../../src/utils/invoiceReminders.ts";
import { MAX_INVOICE_REMINDERS_PER_INVOICE } from "../../src/lib/domain-vocabulary.ts";

beforeEach(() => {
  prisma.__reset();
});

const ALL_STEPS = ["due_minus_3", "due_plus_1", "due_plus_7", "due_plus_14"];

test("sanitizeReminderSchedule drops unknown steps and de-duplicates, never throwing", () => {
  assert.deepEqual(sanitizeReminderSchedule(["due_minus_3", "due_minus_3", "bogus", "due_plus_7"]), ["due_minus_3", "due_plus_7"]);
  assert.deepEqual(sanitizeReminderSchedule(null), []);
  assert.deepEqual(sanitizeReminderSchedule(undefined), []);
  assert.deepEqual(sanitizeReminderSchedule("due_plus_1"), []);
  assert.deepEqual(sanitizeReminderSchedule([1, {}, "due_plus_14"]), ["due_plus_14"]);
});

test("addDaysToDateOnly handles month and year rollovers", () => {
  assert.equal(addDaysToDateOnly("2026-01-30", 3), "2026-02-02");
  assert.equal(addDaysToDateOnly("2026-12-30", 3), "2027-01-02");
  assert.equal(addDaysToDateOnly("2026-03-05", -3), "2026-03-02");
  assert.equal(addDaysToDateOnly("2026-03-01", -3), "2026-02-26");
});

test("dateOnlyInTimeZone reads the calendar date in the given zone, not UTC", () => {
  // 2026-01-01 05:00 UTC is still 2025-12-31 in US/Pacific.
  const instant = new Date("2026-01-01T05:00:00.000Z");
  assert.equal(dateOnlyInTimeZone(instant, "UTC"), "2026-01-01");
  assert.equal(dateOnlyInTimeZone(instant, "America/Los_Angeles"), "2025-12-31");
  // An unknown zone falls back to UTC instead of throwing.
  assert.equal(dateOnlyInTimeZone(instant, "Not/AZone"), "2026-01-01");
});

test("selectDueReminderStep picks the earliest due, not-yet-sent enabled step", () => {
  const dueDate = new Date("2026-09-24T00:00:00.000Z"); // due day itself

  // 3 days before due: eligible starting 2026-09-21.
  assert.equal(
    selectDueReminderStep({ dueDate, now: new Date("2026-09-20T12:00:00.000Z"), timeZone: "UTC", enabledSteps: ALL_STEPS, sentSteps: [] }),
    null,
  );
  assert.equal(
    selectDueReminderStep({ dueDate, now: new Date("2026-09-21T00:00:00.000Z"), timeZone: "UTC", enabledSteps: ALL_STEPS, sentSteps: [] }),
    "due_minus_3",
  );

  // Once due_minus_3 is sent, the next due step (due_plus_1) isn't picked until it arrives.
  assert.equal(
    selectDueReminderStep({ dueDate, now: new Date("2026-09-23T00:00:00.000Z"), timeZone: "UTC", enabledSteps: ALL_STEPS, sentSteps: ["due_minus_3"] }),
    null,
  );
  assert.equal(
    selectDueReminderStep({ dueDate, now: new Date("2026-09-25T00:00:00.000Z"), timeZone: "UTC", enabledSteps: ALL_STEPS, sentSteps: ["due_minus_3"] }),
    "due_plus_1",
  );

  // A schedule with a step disabled skips straight to the next enabled one.
  assert.equal(
    selectDueReminderStep({ dueDate, now: new Date("2026-10-10T00:00:00.000Z"), timeZone: "UTC", enabledSteps: ["due_minus_3", "due_plus_7"], sentSteps: ["due_minus_3"] }),
    "due_plus_7",
  );

  // Every step already sent: nothing left to select (no double send).
  assert.equal(
    selectDueReminderStep({ dueDate, now: new Date("2026-12-01T00:00:00.000Z"), timeZone: "UTC", enabledSteps: ALL_STEPS, sentSteps: ALL_STEPS }),
    null,
  );
});

test("selectDueReminderStep uses the owner's timezone, not UTC, for the calendar-day boundary", () => {
  // Due at 2026-09-24T00:00:00Z — in America/Los_Angeles that instant is still
  // 2026-09-23. "3 days before due" (due_minus_3) in that zone lands on
  // 2026-09-20, one day earlier than the UTC-naive answer would give.
  const dueDate = new Date("2026-09-24T00:00:00.000Z");
  assert.equal(
    selectDueReminderStep({ dueDate, now: new Date("2026-09-20T12:00:00.000Z"), timeZone: "America/Los_Angeles", enabledSteps: ALL_STEPS, sentSteps: [] }),
    "due_minus_3",
  );
  // The same instant, read in UTC, is one calendar day later — not yet due.
  assert.equal(
    selectDueReminderStep({ dueDate, now: new Date("2026-09-20T12:00:00.000Z"), timeZone: "UTC", enabledSteps: ALL_STEPS, sentSteps: [] }),
    null,
  );
});

test("isInvoiceEligibleForReminders enforces every exclusion", () => {
  const base = {
    status: "sent",
    dueDate: new Date(),
    remindersPaused: false,
    ownerRemindersEnabled: true,
    clientEmail: "client@example.com",
    clientOptedOut: false,
    sentReminderCount: 0,
  };
  assert.equal(isInvoiceEligibleForReminders(base), true);

  assert.equal(isInvoiceEligibleForReminders({ ...base, ownerRemindersEnabled: false }), false);
  assert.equal(isInvoiceEligibleForReminders({ ...base, dueDate: null }), false);
  assert.equal(isInvoiceEligibleForReminders({ ...base, remindersPaused: true }), false);
  assert.equal(isInvoiceEligibleForReminders({ ...base, clientEmail: null }), false);
  assert.equal(isInvoiceEligibleForReminders({ ...base, clientOptedOut: true }), false, "unsubscribe must be honoured");
  assert.equal(isInvoiceEligibleForReminders({ ...base, status: "draft" }), false);
  assert.equal(isInvoiceEligibleForReminders({ ...base, status: "paid" }), false, "a paid invoice stops receiving reminders");
  assert.equal(isInvoiceEligibleForReminders({ ...base, status: "cancelled" }), false);
  assert.equal(isInvoiceEligibleForReminders({ ...base, status: "voided" }), false);
  // Still-unpaid partial payments keep reminding.
  assert.equal(isInvoiceEligibleForReminders({ ...base, status: "partially_paid" }), true);
  assert.equal(isInvoiceEligibleForReminders({ ...base, status: "overdue" }), true);
  // The per-invoice cap.
  assert.equal(isInvoiceEligibleForReminders({ ...base, sentReminderCount: MAX_INVOICE_REMINDERS_PER_INVOICE }), false);
  assert.equal(isInvoiceEligibleForReminders({ ...base, sentReminderCount: MAX_INVOICE_REMINDERS_PER_INVOICE - 1 }), true);
});

test("a pause request scoped to the wrong owner touches no row (cross-tenant rejection)", async () => {
  const invoice = { id: "inv-1", userId: "owner-a", remindersPaused: false, status: "sent", createdAt: new Date(), updatedAt: new Date() };
  prisma.__db.invoice.push(invoice);

  const result = await prisma.invoice.updateMany({ where: { id: "inv-1", userId: "owner-b" }, data: { remindersPaused: true } });
  assert.equal(result.count, 0);
  assert.equal(prisma.__db.invoice.find((row) => row.id === "inv-1").remindersPaused, false);

  const ownResult = await prisma.invoice.updateMany({ where: { id: "inv-1", userId: "owner-a" }, data: { remindersPaused: true } });
  assert.equal(ownResult.count, 1);
  assert.equal(prisma.__db.invoice.find((row) => row.id === "inv-1").remindersPaused, true);
});
