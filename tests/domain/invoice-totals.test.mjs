import assert from "node:assert/strict";
import test from "node:test";
import {
  OPEN_STATUSES,
  collectedAmount,
  isIssuedStatus,
  isOpenStatus,
  isPastDue,
  outstandingAmount,
} from "../../src/utils/invoiceTotals.ts";

const NOW = new Date("2026-08-19T00:00:00.000Z");
const PAST = new Date("2026-08-01T00:00:00.000Z");
const FUTURE = new Date("2026-09-30T00:00:00.000Z");

/* The demo workspace's three overdue INR invoices. RIVE-2026-017 is the only
   one that separates the two definitions: 194,700 billed, 100,000 already
   collected, 94,700 still owed. */
const OVERDUE = [
  { number: "RIVE-2026-018", currency: "INR", status: "overdue", total: 112_100, amountPaid: 0, dueDate: PAST },
  { number: "RIVE-2026-021", currency: "INR", status: "overdue", total: 100_300, amountPaid: 0, dueDate: PAST },
  { number: "RIVE-2026-017", currency: "INR", status: "overdue", total: 194_700, amountPaid: 100_000, dueDate: PAST },
];

/* How the revenue workspace aggregates: one invoice at a time. */
function revenueStyle(invoices, now) {
  let collected = 0;
  let outstanding = 0;
  let overdue = 0;
  let overdueCount = 0;
  for (const invoice of invoices) {
    if (!isIssuedStatus(invoice.status)) continue;
    const owed = outstandingAmount(invoice.total, invoice.amountPaid);
    collected += collectedAmount(invoice.total, invoice.amountPaid);
    outstanding += owed;
    if (owed > 0 && isPastDue(invoice.dueDate, now)) {
      overdue += owed;
      overdueCount += 1;
    }
  }
  return { collected, outstanding, overdue, overdueCount };
}

/* How the Overview aggregates: pre-summed groups out of the database, never
   the individual rows. The two must land on the same numbers regardless. */
function overviewStyle(invoices, now) {
  const openStatuses = new Set(OPEN_STATUSES);
  const byStatus = new Map();
  const overdueByCurrency = new Map();
  for (const invoice of invoices) {
    const key = invoice.status + ":" + invoice.currency;
    const group = byStatus.get(key) || { status: invoice.status, total: 0, amountPaid: 0 };
    group.total += invoice.total;
    group.amountPaid += invoice.amountPaid;
    byStatus.set(key, group);

    if (openStatuses.has(invoice.status) && isPastDue(invoice.dueDate, now)) {
      const bucket = overdueByCurrency.get(invoice.currency) || { total: 0, amountPaid: 0, count: 0 };
      bucket.total += invoice.total;
      bucket.amountPaid += invoice.amountPaid;
      bucket.count += 1;
      overdueByCurrency.set(invoice.currency, bucket);
    }
  }
  let collected = 0;
  let outstanding = 0;
  for (const group of byStatus.values()) {
    if (!isIssuedStatus(group.status)) continue;
    collected += collectedAmount(group.total, group.amountPaid);
    outstanding += outstandingAmount(group.total, group.amountPaid);
  }
  let overdue = 0;
  let overdueCount = 0;
  for (const bucket of overdueByCurrency.values()) {
    overdue += outstandingAmount(bucket.total, bucket.amountPaid);
    overdueCount += bucket.count;
  }
  return { collected, outstanding, overdue, overdueCount };
}

test("splits a partly paid invoice into money banked and money still owed", () => {
  assert.equal(collectedAmount(194_700, 100_000), 100_000);
  assert.equal(outstandingAmount(194_700, 100_000), 94_700);
  assert.equal(collectedAmount(194_700, 100_000) + outstandingAmount(194_700, 100_000), 194_700);
});

test("the Overview and the revenue workspace report one Overdue total", () => {
  const revenue = revenueStyle(OVERDUE, NOW);
  const overview = overviewStyle(OVERDUE, NOW);
  /* 307,100 is the sum of the balances. 407,100 — the figure the Overview used
     to show — is the gross value, and it double-counts the 100,000 already
     banked on RIVE-2026-017. */
  assert.equal(revenue.overdue, 307_100);
  assert.equal(overview.overdue, 307_100);
  assert.deepEqual(overview, revenue);
  assert.equal(overview.overdueCount, 3);
});

test("counts a partly paid invoice that is not yet due as outstanding", () => {
  /* This one used to fall through every bucket on the Overview: not "sent" or
     "viewed", so not pending; not past due, so not overdue; not "paid", so its
     collected half went unreported too. */
  const invoices = [{ number: "RIVE-2026-030", currency: "INR", status: "partially_paid", total: 50_000, amountPaid: 20_000, dueDate: FUTURE }];
  const revenue = revenueStyle(invoices, NOW);
  assert.deepEqual(overviewStyle(invoices, NOW), revenue);
  assert.equal(revenue.collected, 20_000);
  assert.equal(revenue.outstanding, 30_000);
  assert.equal(revenue.overdue, 0);
});

test("treats a past-due invoice as overdue before the lifecycle refresh relabels it", () => {
  /* Lifecycle no longer rewrites partially_paid to overdue. Outstanding still
     uses isPastDue so figures do not depend on which status label is stored. */
  const beforeRefresh = [{ number: "RIVE-2026-017", currency: "INR", status: "partially_paid", total: 194_700, amountPaid: 100_000, dueDate: PAST }];
  const afterRefresh = [{ ...beforeRefresh[0], status: "overdue" }];
  assert.deepEqual(overviewStyle(beforeRefresh, NOW), overviewStyle(afterRefresh, NOW));
  assert.equal(overviewStyle(beforeRefresh, NOW).overdue, 94_700);
});

test("keeps collected and outstanding adding up to what was invoiced", () => {
  const invoices = [
    ...OVERDUE,
    { number: "RIVE-2026-022", currency: "INR", status: "paid", total: 60_000, amountPaid: 60_000, dueDate: PAST },
    { number: "RIVE-2026-023", currency: "INR", status: "sent", total: 25_000, amountPaid: 0, dueDate: FUTURE },
    { number: "RIVE-2026-024", currency: "INR", status: "draft", total: 90_000, amountPaid: 0, dueDate: null },
    { number: "RIVE-2026-025", currency: "INR", status: "voided", total: 40_000, amountPaid: 0, dueDate: PAST },
  ];
  const issued = invoices.filter((invoice) => isIssuedStatus(invoice.status)).reduce((sum, invoice) => sum + invoice.total, 0);
  const totals = revenueStyle(invoices, NOW);
  assert.deepEqual(overviewStyle(invoices, NOW), totals);
  assert.equal(totals.collected + totals.outstanding, issued);
  /* Drafts and voided invoices are not money anyone is owed. */
  assert.equal(issued, 492_100);
  assert.equal(totals.overdue, 307_100);
});

test("does not treat drafts or closed invoices as billed or collectable", () => {
  for (const status of ["draft", "voided", "cancelled"]) {
    assert.equal(isIssuedStatus(status), false, status);
    assert.equal(isOpenStatus(status), false, status);
  }
  assert.equal(isIssuedStatus("paid"), true);
  assert.equal(isOpenStatus("paid"), false, "a paid invoice has nothing left to collect");
  assert.equal(isOpenStatus("partially_paid"), true);
});

test("refuses to invent revenue or a negative balance from bad amounts", () => {
  assert.equal(collectedAmount(1_000, -50), 0);
  assert.equal(outstandingAmount(1_000, -50), 1_000);
  assert.equal(collectedAmount(1_000, 4_000), 1_000);
  assert.equal(outstandingAmount(1_000, 4_000), 0);
});

test("judges past due on the date, and never on a missing one", () => {
  assert.equal(isPastDue(PAST, NOW), true);
  assert.equal(isPastDue(FUTURE, NOW), false);
  assert.equal(isPastDue(null, NOW), false);
  assert.equal(isPastDue(PAST.toISOString(), NOW), true);
});
