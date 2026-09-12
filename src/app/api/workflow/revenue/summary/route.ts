import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { monthlyCohortRows } from "@/utils/revenueTrend";
import { refreshOverdueInvoices } from "@/utils/invoiceLifecycle";
import { ISSUED_STATUSES, collectedAmount, isIssuedStatus, outstandingAmount } from "@/utils/invoiceTotals";

type CurrencySummary = {
  currency: string;
  issued: number;
  collected: number;
  outstanding: number;
  overdue: number;
  draft: number;
  invoiceCount: number;
  paidCount: number;
  collectionRate: number | null;
  /** `amountPaid` with no dated receipt row: legacy/imported history. */
  collectionsWithoutPaymentDate: number;
  /** Receipt rows totalling more than `amountPaid`: investigate, never net. */
  paymentReconciliationExcess: number;
};

type AgingRow = {
  currency: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days90Plus: number;
  noDueDate: number;
};

type AttentionRow = {
  id: string;
  invoiceNumber: string;
  currency: string;
  status: string;
  outstanding: number;
  dueDate: string | null;
  client: string | null;
  reason: string;
};

const SUMMARY_PAGE_SIZE = 1_000;

function addCurrency(map: Map<string, CurrencySummary>, currency: string): CurrencySummary {
  const existing = map.get(currency);
  if (existing) return existing;
  const created: CurrencySummary = {
    currency, issued: 0, collected: 0, outstanding: 0, overdue: 0, draft: 0,
    invoiceCount: 0, paidCount: 0, collectionRate: null,
    collectionsWithoutPaymentDate: 0, paymentReconciliationExcess: 0,
  };
  map.set(currency, created);
  return created;
}

function addAging(map: Map<string, AgingRow>, currency: string): AgingRow {
  const existing = map.get(currency);
  if (existing) return existing;
  const created: AgingRow = { currency, current: 0, days30: 0, days60: 0, days90: 0, days90Plus: 0, noDueDate: 0 };
  map.set(currency, created);
  return created;
}

/** Keep the request bounded while retaining the twelve largest balances. */
function retainAttention(rows: AttentionRow[], row: AttentionRow): void {
  rows.push(row);
  if (rows.length > 24) {
    rows.sort((a, b) => b.outstanding - a.outstanding || a.id.localeCompare(b.id));
    rows.length = 12;
  }
}

function daysPastDue(dueDate: Date | null, now: Date): number | null {
  if (!dueDate || dueDate >= now) return null;
  return Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
}

/* Cash-reporting helpers shared with the overview route (kept local so this
   route owns its reporting rule). Cash is grouped by receipt `paidAt` in the
   owner's calendar; the issue-month cohort below keeps its own meaning. */
function summaryTimeZoneFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    calendar: "iso8601",
    numberingSystem: "latn",
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function normalizeSummaryTimeZone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "UTC";
  try {
    summaryTimeZoneFormatter(value).format();
    return value;
  } catch {
    return "UTC";
  }
}

function monthKeyInTimeZone(value: Date | string, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid financial timestamp.");
  const parts = Object.fromEntries(summaryTimeZoneFormatter(timeZone).formatToParts(date).map((part) => [part.type, part.value]));
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}`;
}

function shiftSummaryMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function summaryDayToInstant(year: number, month: number, day: number, timeZone: string): Date {
  const targetUtc = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-US", {
    calendar: "iso8601",
    numberingSystem: "latn",
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  let candidate = targetUtc;
  for (let index = 0; index < 4; index += 1) {
    const local = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]));
    const localAsUtc = Date.UTC(
      Number(local.year), Number(local.month) - 1, Number(local.day),
      Number(local.hour), Number(local.minute), Number(local.second),
    );
    candidate += targetUtc - localAsUtc;
  }
  return new Date(candidate);
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  await refreshOverdueInvoices(session.userId);

  try {
    const now = new Date();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || "";
    const projectId = searchParams.get("projectId") || "";
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      userId: session.userId,
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
    };

    const owner = await prisma.user.findUnique({ where: { id: session.userId }, select: { timeZone: true } });
    const reportingTimeZone = normalizeSummaryTimeZone(owner?.timeZone);
    const currentMonth = monthKeyInTimeZone(now, reportingTimeZone);
    const firstMonth = shiftSummaryMonth(currentMonth, -5);
    const [startYear, startMonth] = firstMonth.split("-").map(Number);
    const [endYear, endMonth] = shiftSummaryMonth(currentMonth, 1).split("-").map(Number);
    const windowStart = summaryDayToInstant(startYear, startMonth, 1, reportingTimeZone);
    const windowEndExclusive = summaryDayToInstant(endYear, endMonth, 1, reportingTimeZone);

    const byCurrency = new Map<string, CurrencySummary>();
    const aging = new Map<string, AgingRow>();
    // Keyed by stable entity id — two clients sharing a display name stay
    // separate rows. The display name remains the label only.
    const byClient = new Map<string, { clientId: string | null; client: string; currency: string; invoiced: number; collected: number; outstanding: number }>();
    const byProject = new Map<string, { projectId: string | null; project: string; currency: string; invoiced: number; collected: number; outstanding: number }>();
    const cohortInputs: Array<{ currency: string; total: number; amountPaid: number; issueDate: Date }> = [];
    const cashByMonth = new Map<string, { month: string; currency: string; cashReceived: number }>();
    const attention: AttentionRow[] = [];

    // Stable primary-key pages: only the current page and its bounded payment
    // page are held in memory, so totals stay complete past the old 20,000-row
    // ceiling without ever loading the workspace into one array.
    let invoiceCursor: string | undefined;
    while (true) {
      const invoices = await prisma.invoice.findMany({
        where: { ...invoiceWhere, ...(invoiceCursor ? { id: { gt: invoiceCursor } } : {}) },
        select: {
          id: true,
          clientId: true,
          projectId: true,
          invoiceNumber: true,
          currency: true,
          status: true,
          total: true,
          amountPaid: true,
          dueDate: true,
          issueDate: true,
          client: { select: { id: true, name: true } },
          project: { select: { id: true, title: true } },
        },
        orderBy: { id: "asc" },
        take: SUMMARY_PAGE_SIZE,
      });
      if (!invoices.length) break;

      const invoiceIds = invoices.map((invoice) => invoice.id);
      const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
      const paymentTotals = new Map<string, number>();
      let paymentCursor: string | undefined;
      while (true) {
        const payments = await prisma.invoicePayment.findMany({
          where: {
            invoiceId: { in: invoiceIds },
            invoice: { status: { in: [...ISSUED_STATUSES] } },
            ...(paymentCursor ? { id: { gt: paymentCursor } } : {}),
          },
          select: { id: true, invoiceId: true, amount: true, paidAt: true },
          orderBy: { id: "asc" },
          take: SUMMARY_PAGE_SIZE,
        });
        for (const payment of payments) {
          const amount = Number(payment.amount);
          paymentTotals.set(payment.invoiceId, (paymentTotals.get(payment.invoiceId) || 0) + amount);
          const invoice = invoicesById.get(payment.invoiceId);
          if (invoice && isIssuedStatus(invoice.status) && payment.paidAt >= windowStart && payment.paidAt < windowEndExclusive) {
            const month = monthKeyInTimeZone(payment.paidAt, reportingTimeZone);
            const currency = invoice.currency.toUpperCase();
            const key = `${month}:${currency}`;
            const row = cashByMonth.get(key) || { month, currency, cashReceived: 0 };
            row.cashReceived += amount;
            cashByMonth.set(key, row);
          }
        }
        if (payments.length < SUMMARY_PAGE_SIZE) break;
        const nextCursor = payments[payments.length - 1]?.id;
        if (!nextCursor || nextCursor === paymentCursor) break;
        paymentCursor = nextCursor;
      }

      for (const invoice of invoices) {
        const currency = invoice.currency.toUpperCase();
        const total = Number(invoice.total);
        const amountPaid = Number(invoice.amountPaid);
        const collected = collectedAmount(total, amountPaid);
        const outstanding = outstandingAmount(total, amountPaid);
        const summary = addCurrency(byCurrency, currency);
        summary.invoiceCount += 1;
        if (invoice.status === "paid") summary.paidCount += 1;
        if (invoice.status === "draft") summary.draft += total;
        if (isIssuedStatus(invoice.status)) {
          summary.issued += total;
          summary.collected += collected;
          summary.outstanding += outstanding;
          const logged = paymentTotals.get(invoice.id) || 0;
          if (amountPaid > logged) summary.collectionsWithoutPaymentDate += amountPaid - logged;
          else if (logged > amountPaid) summary.paymentReconciliationExcess += logged - amountPaid;
          cohortInputs.push({ currency: invoice.currency, total, amountPaid, issueDate: invoice.issueDate });
        }

        if (outstanding > 0 && isIssuedStatus(invoice.status)) {
          const overdueDays = daysPastDue(invoice.dueDate, now);
          if (overdueDays !== null) {
            summary.overdue += outstanding;
            const bucket = addAging(aging, currency);
            if (overdueDays <= 30) bucket.days30 += outstanding;
            else if (overdueDays <= 60) bucket.days60 += outstanding;
            else if (overdueDays <= 90) bucket.days90 += outstanding;
            else bucket.days90Plus += outstanding;
          } else {
            const bucket = addAging(aging, currency);
            if (invoice.dueDate) bucket.current += outstanding;
            else bucket.noDueDate += outstanding;
          }
        }

        const client = invoice.client?.name || "Unassigned client";
        const clientKey = `${invoice.clientId || "unassigned"}:${currency}`;
        const clientRow = byClient.get(clientKey) || { clientId: invoice.clientId, client, currency, invoiced: 0, collected: 0, outstanding: 0 };
        if (isIssuedStatus(invoice.status)) { clientRow.invoiced += total; clientRow.collected += collected; clientRow.outstanding += outstanding; }
        byClient.set(clientKey, clientRow);
        const project = invoice.project?.title || "Unassigned project";
        const projectKey = `${invoice.projectId || "unassigned"}:${currency}`;
        const projectRow = byProject.get(projectKey) || { projectId: invoice.projectId, project, currency, invoiced: 0, collected: 0, outstanding: 0 };
        if (isIssuedStatus(invoice.status)) { projectRow.invoiced += total; projectRow.collected += collected; projectRow.outstanding += outstanding; }
        byProject.set(projectKey, projectRow);

        const overdueDays = daysPastDue(invoice.dueDate, now);
        if (invoice.status === "overdue" || (overdueDays !== null && outstanding > 0)) {
          retainAttention(attention, { id: invoice.id, invoiceNumber: invoice.invoiceNumber, currency, status: invoice.status, outstanding, dueDate: invoice.dueDate?.toISOString() || null, client: invoice.client?.name || null, reason: "Payment is overdue" });
        } else if (invoice.status === "draft" && (!invoice.client || !invoice.dueDate)) {
          retainAttention(attention, { id: invoice.id, invoiceNumber: invoice.invoiceNumber, currency, status: invoice.status, outstanding: total, dueDate: invoice.dueDate?.toISOString() || null, client: invoice.client?.name || null, reason: !invoice.client ? "Add a client before sending" : "Add a due date before sending" });
        }
      }

      if (invoices.length < SUMMARY_PAGE_SIZE) break;
      const nextCursor = invoices[invoices.length - 1]?.id;
      if (!nextCursor || nextCursor === invoiceCursor) break;
      invoiceCursor = nextCursor;
    }

    for (const row of byCurrency.values()) row.collectionRate = row.issued > 0 ? Math.round((row.collected / row.issued) * 1000) / 10 : null;

    /* One cohort per row — `monthlyCohortRows` owns the rule (issue-month
       invoiced vs collected on that cohort). Fed the same inputs, it returns
       the same rows; paging only changes how the inputs are gathered. */
    const monthlyRevenue = monthlyCohortRows(cohortInputs)
      .sort((a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency))
      .slice(-24);
    const sortedCash = [...cashByMonth.values()].sort((a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency));
    const integrity = [...byCurrency.values()]
      .filter((row) => row.collectionsWithoutPaymentDate > 0 || row.paymentReconciliationExcess > 0)
      .map((row) => ({ currency: row.currency, collectionsWithoutPaymentDate: row.collectionsWithoutPaymentDate, paymentReconciliationExcess: row.paymentReconciliationExcess }));

    return NextResponse.json({
      success: true,
      currencies: Array.from(byCurrency.values()),
      aging: Array.from(aging.values()),
      monthlyRevenue,
      // Cash received by payment month, so the cohort above can never be read
      // as cash. Same definition as the overview chart.
      cashByMonth: sortedCash,
      financialIntegrity: integrity,
      reportingDefinitions: {
        cashByMonth: { label: "Cash received by payment month", source: "InvoicePayment.amount grouped by paidAt", timeZone: reportingTimeZone, startMonth: firstMonth, endMonth: currentMonth },
        monthlyRevenue: { label: "Invoice cohort by issue month", source: "Invoice.total and amountPaid grouped by issueDate", timeZone: "UTC" },
        collectionsWithoutPaymentDate: "Positive amountPaid minus logged payment rows; legacy/imported collection without a payment-date history.",
        paymentReconciliationExcess: "Positive logged payment rows minus amountPaid; investigate this reconciliation error.",
      },
      byClient: Array.from(byClient.values()).sort((a, b) => b.invoiced - a.invoiced || (a.clientId || "").localeCompare(b.clientId || "")).slice(0, 20),
      byProject: Array.from(byProject.values()).sort((a, b) => b.invoiced - a.invoiced || (a.projectId || "").localeCompare(b.projectId || "")).slice(0, 20),
      attention: attention.sort((a, b) => b.outstanding - a.outstanding || a.id.localeCompare(b.id)).slice(0, 12),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Revenue summary error:", error);
    return NextResponse.json({ success: false, message: "Revenue summary is temporarily unavailable." }, { status: 503 });
  }
}
