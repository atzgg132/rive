import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { monthlyCohortRows } from "@/utils/revenueTrend";
import { refreshOverdueInvoices } from "@/utils/invoiceLifecycle";
import { collectedAmount, isIssuedStatus, outstandingAmount } from "@/utils/invoiceTotals";

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
};

function addCurrency(map: Map<string, CurrencySummary>, currency: string): CurrencySummary {
  const existing = map.get(currency);
  if (existing) return existing;
  const created: CurrencySummary = { currency, issued: 0, collected: 0, outstanding: 0, overdue: 0, draft: 0, invoiceCount: 0, paidCount: 0, collectionRate: null };
  map.set(currency, created);
  return created;
}

function daysPastDue(dueDate: Date | null, now: Date): number | null {
  if (!dueDate || dueDate >= now) return null;
  return Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
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
    const [invoices, events] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceWhere,
        select: {
          id: true, invoiceNumber: true, currency: true, status: true, total: true, amountPaid: true,
          dueDate: true, issueDate: true, paidDate: true, updatedAt: true,
          client: { select: { name: true } }, project: { select: { title: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 20_000,
      }),
      prisma.invoiceEvent.findMany({
        where: { invoice: invoiceWhere },
        select: { eventType: true, createdAt: true, metadata: true, invoice: { select: { invoiceNumber: true, currency: true } } },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

    const byCurrency = new Map<string, CurrencySummary>();
    const aging = new Map<string, { currency: string; current: number; days30: number; days60: number; days90: number; days90Plus: number; noDueDate: number }>();
    const byClient = new Map<string, { client: string; currency: string; invoiced: number; collected: number; outstanding: number }>();
    const byProject = new Map<string, { project: string; currency: string; invoiced: number; collected: number; outstanding: number }>();
    const attention: Array<{ id: string; invoiceNumber: string; currency: string; status: string; outstanding: number; dueDate: string | null; client: string | null; reason: string }> = [];

    for (const invoice of invoices) {
      const currency = invoice.currency.toUpperCase();
      const total = Number(invoice.total);
      const collected = collectedAmount(total, Number(invoice.amountPaid));
      const outstanding = outstandingAmount(total, Number(invoice.amountPaid));
      const summary = addCurrency(byCurrency, currency);
      summary.invoiceCount += 1;
      if (invoice.status === "paid") summary.paidCount += 1;
      if (invoice.status === "draft") summary.draft += total;
      if (isIssuedStatus(invoice.status)) {
        summary.issued += total;
        summary.collected += collected;
        summary.outstanding += outstanding;
      }

      if (outstanding > 0 && isIssuedStatus(invoice.status)) {
        const overdueDays = daysPastDue(invoice.dueDate, now);
        if (overdueDays !== null) {
          summary.overdue += outstanding;
          const agingKey = currency;
          const bucket = aging.get(agingKey) || { currency, current: 0, days30: 0, days60: 0, days90: 0, days90Plus: 0, noDueDate: 0 };
          if (overdueDays <= 30) bucket.days30 += outstanding;
          else if (overdueDays <= 60) bucket.days60 += outstanding;
          else if (overdueDays <= 90) bucket.days90 += outstanding;
          else bucket.days90Plus += outstanding;
          aging.set(agingKey, bucket);
        } else {
          const bucket = aging.get(currency) || { currency, current: 0, days30: 0, days60: 0, days90: 0, days90Plus: 0, noDueDate: 0 };
          if (invoice.dueDate) bucket.current += outstanding;
          else bucket.noDueDate += outstanding;
          aging.set(currency, bucket);
        }
      }

      const client = invoice.client?.name || "Unassigned client";
      const clientKey = `${client}:${currency}`;
      const clientRow = byClient.get(clientKey) || { client, currency, invoiced: 0, collected: 0, outstanding: 0 };
      if (isIssuedStatus(invoice.status)) { clientRow.invoiced += total; clientRow.collected += collected; clientRow.outstanding += outstanding; }
      byClient.set(clientKey, clientRow);
      const project = invoice.project?.title || "Unassigned project";
      const projectKey = `${project}:${currency}`;
      const projectRow = byProject.get(projectKey) || { project, currency, invoiced: 0, collected: 0, outstanding: 0 };
      if (isIssuedStatus(invoice.status)) { projectRow.invoiced += total; projectRow.collected += collected; projectRow.outstanding += outstanding; }
      byProject.set(projectKey, projectRow);

      const overdueDays = daysPastDue(invoice.dueDate, now);
      if (invoice.status === "overdue" || (overdueDays !== null && outstanding > 0)) {
        attention.push({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, currency, status: invoice.status, outstanding, dueDate: invoice.dueDate?.toISOString() || null, client: invoice.client?.name || null, reason: "Payment is overdue" });
      } else if (invoice.status === "draft" && (!invoice.client || !invoice.dueDate)) {
        attention.push({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, currency, status: invoice.status, outstanding: total, dueDate: invoice.dueDate?.toISOString() || null, client: invoice.client?.name || null, reason: !invoice.client ? "Add a client before sending" : "Add a due date before sending" });
      }
    }

    for (const row of byCurrency.values()) row.collectionRate = row.issued > 0 ? Math.round((row.collected / row.issued) * 1000) / 10 : null;

    return NextResponse.json({
      success: true,
      currencies: Array.from(byCurrency.values()),
      aging: Array.from(aging.values()),
      /* One cohort per row — see `monthlyCohortRows`, which owns the rule and
         carries its tests. */
      monthlyRevenue: monthlyCohortRows(
        invoices
          .filter((invoice) => isIssuedStatus(invoice.status))
          .map((invoice) => ({
            currency: invoice.currency,
            total: Number(invoice.total),
            amountPaid: Number(invoice.amountPaid),
            issueDate: invoice.issueDate,
          })),
      ).slice(-24),
      byClient: Array.from(byClient.values()).sort((a, b) => b.invoiced - a.invoiced).slice(0, 20),
      byProject: Array.from(byProject.values()).sort((a, b) => b.invoiced - a.invoiced).slice(0, 20),
      recentActivity: events.map((event) => ({ eventType: event.eventType, createdAt: event.createdAt, invoiceNumber: event.invoice.invoiceNumber, currency: event.invoice.currency, metadata: event.metadata })),
      attention: attention.sort((a, b) => b.outstanding - a.outstanding).slice(0, 12),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Revenue summary error:", error);
    return NextResponse.json({ success: false, message: "Revenue summary is temporarily unavailable." }, { status: 503 });
  }
}
