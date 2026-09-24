import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { buildWeeklySummaryEmail, type WeeklySummaryEmailSection } from "@/utils/email";
import { enqueueEmail } from "@/utils/emailOutbox";
import { buildWeeklySummaryContent, selectDueForWeeklySummary } from "@/utils/weeklySummary";
import { normalizeCurrency, formatMoney } from "@/lib/currency";
import { convertFromSnapshot, getExchangeRateSnapshot, type ExchangeRateSnapshot } from "@/utils/exchangeRates";
import { ISSUED_STATUSES, isIssuedStatus, outstandingAmount } from "@/utils/invoiceTotals";
import { contractsAvailable } from "@/utils/contracts";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { prepareAuthToken } from "@/utils/authTokens";
import { logger, requestLogContext } from "@/utils/logger";

export const dynamic = "force-dynamic";

const appUrl = (process.env.APP_URL || "https://www.rive.work").replace(/\/$/, "");

type Candidate = {
  id: string;
  email: string;
  name: string | null;
  timeZone: string;
  displayCurrency: string;
  weeklySummaryLastSentAt: Date | null;
  weeklySummaryEnabled: boolean;
};

function dateLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(date);
}

function dateTimeLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

async function sendWeeklySummaryForUser(
  user: Candidate,
  now: Date,
  opts: { agreementsEnabled: boolean; exchangeRates: ExchangeRateSnapshot | null },
): Promise<"sent" | "skipped_empty" | "skipped_claimed"> {
  const displayCurrency = normalizeCurrency(user.displayCurrency);
  const convert = (amount: number, currency: string) => convertFromSnapshot(amount, currency, displayCurrency, opts.exchangeRates) ?? 0;

  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const upcomingEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [paidPayments, invoiceAggregate, deadlines, meetings, agreementsAwaiting] = await Promise.all([
    prisma.invoicePayment.findMany({
      where: { paidAt: { gte: weekStart, lt: now }, invoice: { userId: user.id, status: { in: [...ISSUED_STATUSES] } } },
      select: { amount: true, invoice: { select: { currency: true } } },
    }),
    prisma.invoice.groupBy({
      by: ["status", "currency"],
      where: { userId: user.id },
      _sum: { total: true, amountPaid: true },
    }),
    prisma.project.findMany({
      where: { userId: user.id, dueDate: { gte: now, lt: upcomingEnd }, status: { notIn: ["completed", "archived"] } },
      select: { id: true, title: true, dueDate: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.calendarEvent.findMany({
      where: { userId: user.id, startAt: { gte: now, lt: upcomingEnd }, status: { not: "cancelled" } },
      select: { id: true, title: true, startAt: true },
      orderBy: { startAt: "asc" },
      take: 10,
    }),
    opts.agreementsEnabled
      ? prisma.contract.findMany({
          where: { userId: user.id, status: "signing" },
          select: { id: true, title: true, client: { select: { name: true } } },
          take: 10,
        })
      : Promise.resolve(null),
  ]);

  const paidLastWeek = paidPayments.reduce((sum, payment) => sum + convert(Number(payment.amount), payment.invoice.currency), 0);
  let outstanding = 0;
  let overdue = 0;
  for (const group of invoiceAggregate) {
    if (!isIssuedStatus(group.status)) continue;
    const amount = convert(outstandingAmount(Number(group._sum.total || 0), Number(group._sum.amountPaid || 0)), group.currency);
    outstanding += amount;
    if (group.status === "overdue") overdue += amount;
  }

  const content = buildWeeklySummaryContent({
    currency: displayCurrency,
    paidLastWeek,
    outstanding,
    overdue,
    deadlines: deadlines
      .filter((project): project is typeof project & { dueDate: Date } => project.dueDate !== null)
      .map((project) => ({ id: project.id, title: project.title, dueDate: project.dueDate })),
    meetings: meetings
      .filter((event): event is typeof event & { startAt: Date } => event.startAt !== null)
      .map((event) => ({ id: event.id, title: event.title, startAt: event.startAt })),
    agreementsAwaitingClient: agreementsAwaiting
      ? agreementsAwaiting.map((contract) => ({ id: contract.id, title: contract.title, clientName: contract.client?.name ?? null }))
      : null,
  });
  if (!content) return "skipped_empty";

  // Prepared, not created: `createAuthToken` retires earlier tokens of the type,
  // which would break the unsubscribe link in every older summary email.
  const unsubscribeToken = prepareAuthToken({ email: user.email, type: "weekly_summary_unsubscribe", userId: user.id });
  const token = unsubscribeToken.token;
  const unsubscribeUrl = `${appUrl}/api/public/weekly-summary/unsubscribe?token=${encodeURIComponent(token)}`;
  const settingsUrl = `${appUrl}/settings`;

  const hasFinancials = content.paidLastWeek > 0 || content.outstanding > 0 || content.overdue > 0;
  const sections: WeeklySummaryEmailSection[] = [];
  if (hasFinancials) {
    sections.push({
      kind: "financials",
      currency: displayCurrency,
      paidLastWeek: formatMoney(content.paidLastWeek, displayCurrency),
      outstanding: formatMoney(content.outstanding, displayCurrency),
      overdue: formatMoney(content.overdue, displayCurrency),
    });
  }
  if (content.deadlines.length) {
    sections.push({ kind: "deadlines", items: content.deadlines.map((project) => ({ title: project.title, dueDate: dateLabel(project.dueDate, user.timeZone) })) });
  }
  if (content.meetings.length) {
    sections.push({ kind: "meetings", items: content.meetings.map((event) => ({ title: event.title, startAt: dateTimeLabel(event.startAt, user.timeZone) })) });
  }
  if (content.agreementsAwaitingClient?.length) {
    sections.push({ kind: "agreements", items: content.agreementsAwaitingClient.map((agreement) => ({ title: agreement.title, clientName: agreement.clientName || "Client" })) });
  }

  // Claim the week before enqueuing: an overlapping cron run that read the
  // same `weeklySummaryLastSentAt` loses this compare-and-set and sends nothing.
  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.user.updateMany({
      where: { id: user.id, weeklySummaryEnabled: true, weeklySummaryLastSentAt: user.weeklySummaryLastSentAt },
      data: { weeklySummaryLastSentAt: now },
    });
    if (claim.count !== 1) return false;
    await tx.authToken.create({ data: unsubscribeToken.data });
    await enqueueEmail(
      buildWeeklySummaryEmail({
        to: user.email,
        name: user.name || "there",
        weekLabel: `Week of ${dateLabel(weekStart, user.timeZone)}`,
        sections,
        unsubscribeUrl,
        settingsUrl,
      }),
      tx,
    );
    return true;
  });
  if (!claimed) return "skipped_claimed";
  await recordProductEvent({ userId: user.id, eventName: PRODUCT_EVENTS.weeklySummarySent, module: "weekly_summary", source: "cron" });
  return "sent";
}

/**
 * Hourly weekly-summary send. Only ever matches users for whom it is currently
 * Monday 08:00-08:59 in their own `User.timeZone` and who have not already
 * been sent one this ISO week — see `src/utils/weeklySummary.ts` for the pure
 * selection rule this route defers every decision to.
 */
export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  const context = requestLogContext(req);
  const now = new Date();

  try {
    const candidates = await prisma.user.findMany({
      where: { weeklySummaryEnabled: true },
      select: { id: true, email: true, name: true, timeZone: true, displayCurrency: true, weeklySummaryLastSentAt: true, weeklySummaryEnabled: true },
    });
    const due = selectDueForWeeklySummary(candidates, now);
    const agreementsEnabled = contractsAvailable();
    const exchangeRates = await getExchangeRateSnapshot();

    let sent = 0;
    let skippedEmpty = 0;
    for (const user of due) {
      try {
        const outcome = await sendWeeklySummaryForUser(user, now, { agreementsEnabled, exchangeRates });
        if (outcome === "sent") sent += 1;
        else if (outcome === "skipped_empty") skippedEmpty += 1;
      } catch (error) {
        logger.error("weekly_summary_user_failed", { ...context, userId: user.id, error });
      }
    }

    return NextResponse.json({ success: true, checked: candidates.length, due: due.length, sent, skippedEmpty });
  } catch (error) {
    logger.error("weekly_summary_cron_failed", { ...context, error });
    return NextResponse.json({ success: false, message: "Weekly summary cron failed." }, { status: 500 });
  }
}
