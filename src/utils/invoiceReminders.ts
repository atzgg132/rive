import "server-only";

import crypto from "crypto";
import { prisma } from "@/utils/db";
import {
  INVOICE_REMINDER_STEPS,
  INVOICE_REMINDER_STEP_OFFSET_DAYS,
  INVOICE_REMINDER_STEP_SET,
  MAX_INVOICE_REMINDERS_PER_INVOICE,
  MAX_INVOICE_REMINDERS_PER_USER_PER_DAY,
  type InvoiceReminderStep,
} from "@/lib/domain-vocabulary";
import { buildInvoiceReminderEmail, buildInvoicePaidReceiptEmail, getEmailProvider } from "@/utils/email";
import { decryptOutboxSecret, encryptOutboxSecret, enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { invoicePublicUrl } from "@/utils/invoicePublic";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuses that still owe money and are eligible for a reminder. */
const REMINDABLE_STATUSES = ["sent", "viewed", "overdue", "partially_paid"];

/**
 * Validate a stored/requested reminder schedule against the known step set,
 * dropping anything unrecognized and de-duplicating. Never throws — a
 * corrupted or stale schedule degrades to "no steps enabled" rather than
 * blocking every other reminder computation.
 */
export function sanitizeReminderSchedule(value: unknown): InvoiceReminderStep[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: InvoiceReminderStep[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !INVOICE_REMINDER_STEP_SET.has(entry) || seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry as InvoiceReminderStep);
  }
  return result;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** The calendar date (YYYY-MM-DD) a timestamp reads as in the given IANA timezone. */
export function dateOnlyInTimeZone(value: Date, timeZone: string): string {
  let zone = timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    zone = "UTC";
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { calendar: "iso8601", numberingSystem: "latn", timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(value)
      .map((part) => [part.type, part.value]),
  );
  return `${String(parts.year).padStart(4, "0")}-${pad2(Number(parts.month))}-${pad2(Number(parts.day))}`;
}

/** Add (possibly negative) whole days to a YYYY-MM-DD calendar date, in UTC-date arithmetic. */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${String(next.getUTCFullYear()).padStart(4, "0")}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

/** Canonical send order: the pre-due nudge, then post-due follow-ups, earliest first. */
function orderedSteps(steps: InvoiceReminderStep[]): InvoiceReminderStep[] {
  const set = new Set(steps);
  return INVOICE_REMINDER_STEPS.filter((step) => set.has(step));
}

/**
 * Picks the one step to send now, in the owner's timezone: the latest enabled
 * step whose date has arrived and that comes after every step already sent.
 * Steps that were already due on the day the invoice went out are skipped —
 * the invoice email itself covered them — and a step overtaken by a later one
 * (after a cron outage, or a late send) is never sent out of order, so a
 * client never gets "due in 3 days" about an invoice that is already overdue.
 */
export function selectDueReminderStep(input: {
  dueDate: Date;
  now: Date;
  timeZone: string;
  enabledSteps: InvoiceReminderStep[];
  sentSteps: string[];
  invoiceSentAt?: Date | null;
}): InvoiceReminderStep | null {
  const todayOnly = dateOnlyInTimeZone(input.now, input.timeZone);
  const dueOnly = dateOnlyInTimeZone(input.dueDate, input.timeZone);
  const sentOnly = input.invoiceSentAt ? dateOnlyInTimeZone(input.invoiceSentAt, input.timeZone) : null;
  const lastSentIndex = Math.max(-1, ...input.sentSteps.map((step) => INVOICE_REMINDER_STEPS.indexOf(step as InvoiceReminderStep)));
  let selected: InvoiceReminderStep | null = null;
  for (const step of orderedSteps(input.enabledSteps)) {
    if (INVOICE_REMINDER_STEPS.indexOf(step) <= lastSentIndex) continue;
    const target = addDaysToDateOnly(dueOnly, INVOICE_REMINDER_STEP_OFFSET_DAYS[step]);
    if (target > todayOnly) break;
    if (sentOnly && target <= sentOnly) continue;
    selected = step;
  }
  return selected;
}

/** Whether an invoice can receive any further reminder at all (independent of which step). */
export function isInvoiceEligibleForReminders(input: {
  status: string;
  dueDate: Date | null;
  remindersPaused: boolean;
  ownerRemindersEnabled: boolean;
  clientEmail: string | null;
  clientOptedOut: boolean;
  sentReminderCount: number;
}): boolean {
  if (!input.ownerRemindersEnabled) return false;
  if (!input.dueDate) return false;
  if (input.remindersPaused) return false;
  if (!input.clientEmail || input.clientOptedOut) return false;
  if (!REMINDABLE_STATUSES.includes(input.status)) return false;
  if (input.sentReminderCount >= MAX_INVOICE_REMINDERS_PER_INVOICE) return false;
  return true;
}

const REMINDER_STEP_LABEL: Record<InvoiceReminderStep, string> = {
  due_minus_3: "due in 3 days",
  due_plus_1: "1 day overdue",
  due_plus_7: "7 days overdue",
  due_plus_14: "14 days overdue",
};

export function reminderStepLabel(step: string): string {
  return REMINDER_STEP_LABEL[step as InvoiceReminderStep] || step;
}

export function createReminderUnsubscribeToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashReminderUnsubscribeToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function reminderUnsubscribeUrl(token: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/public/invoice-reminders/unsubscribe/${encodeURIComponent(token)}`;
}

type ReminderCandidate = {
  id: string;
  userId: string;
  invoiceNumber: string;
  currency: string;
  total: { toString(): string };
  amountPaid: { toString(): string };
  dueDate: Date | null;
  status: string;
  remindersPaused: boolean;
  sentAt: Date | null;
  publicTokenEncrypted: string | null;
  reminders: { step: string }[];
  user: {
    id: string;
    name: string | null;
    email: string;
    timeZone: string;
    invoiceProfile: { remindersEnabled: boolean; reminderSchedule: string[]; businessName: string | null } | null;
  };
  client: {
    id: string;
    name: string;
    email: string | null;
    remindersOptedOut: boolean;
    remindersUnsubscribeTokenHash: string | null;
    remindersUnsubscribeTokenEncrypted: string | null;
  } | null;
};

/** Start-of-day (UTC) count of reminders already sent for this user, used for the daily cap. */
async function countRemindersSentTodayForUser(userId: string, now: Date): Promise<number> {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return prisma.invoiceReminder.count({
    where: { sentAt: { gte: startOfDay }, invoice: { userId } },
  });
}

/** The invoice's already-issued public link, recovered from the encrypted copy kept at send time. */
function recoverInvoicePublicUrl(publicTokenEncrypted: string | null): string | undefined {
  if (!publicTokenEncrypted) return undefined;
  try {
    return invoicePublicUrl(decryptOutboxSecret(publicTokenEncrypted));
  } catch {
    return undefined;
  }
}

function decryptUnsubscribeUrl(encrypted: string | null): string | undefined {
  if (!encrypted) return undefined;
  try {
    return reminderUnsubscribeUrl(decryptOutboxSecret(encrypted));
  } catch {
    return undefined;
  }
}

/** The client's one reminder-unsubscribe link, minted on first use and recalled after. */
async function clientUnsubscribeUrl(client: NonNullable<ReminderCandidate["client"]>): Promise<string | undefined> {
  if (client.remindersUnsubscribeTokenHash) return decryptUnsubscribeUrl(client.remindersUnsubscribeTokenEncrypted);
  const token = createReminderUnsubscribeToken();
  const claimed = await prisma.client.updateMany({
    where: { id: client.id, remindersUnsubscribeTokenHash: null },
    data: { remindersUnsubscribeTokenHash: hashReminderUnsubscribeToken(token), remindersUnsubscribeTokenEncrypted: encryptOutboxSecret(token) },
  });
  if (claimed.count === 1) return reminderUnsubscribeUrl(token);
  // Another run minted it first; use theirs.
  const current = await prisma.client.findUnique({ where: { id: client.id }, select: { remindersUnsubscribeTokenEncrypted: true } });
  return decryptUnsubscribeUrl(current?.remindersUnsubscribeTokenEncrypted ?? null);
}

/**
 * Enqueue exactly one reminder for one invoice/step. Relies on the unique
 * (invoiceId, step) constraint: a P2002 conflict means another process
 * already recorded this step, so the caller safely no-ops instead of double
 * sending.
 */
async function enqueueReminder(candidate: ReminderCandidate, step: InvoiceReminderStep): Promise<boolean> {
  const client = candidate.client;
  if (!client?.email) return false;

  const unsubscribeUrl = await clientUnsubscribeUrl(client);

  const senderName = candidate.user.invoiceProfile?.businessName || candidate.user.name || candidate.user.email;
  const outstanding = (Number(candidate.total.toString()) - Number(candidate.amountPaid.toString())).toFixed(2);
  const email = buildInvoiceReminderEmail({
    to: client.email,
    clientName: client.name,
    invoiceNumber: candidate.invoiceNumber,
    total: outstanding,
    currency: candidate.currency,
    dueDate: candidate.dueDate,
    senderName,
    publicUrl: recoverInvoicePublicUrl(candidate.publicTokenEncrypted),
    step,
    unsubscribeUrl,
  });

  try {
    let outboxId = "";
    await prisma.$transaction(async (tx) => {
      await tx.invoiceReminder.create({ data: { invoiceId: candidate.id, step } });
      outboxId = await enqueueEmail(email, tx);
      await tx.invoiceReminder.updateMany({ where: { invoiceId: candidate.id, step }, data: { outboxId } });
    });
    if (getEmailProvider() !== "disabled") {
      await processEmailOutbox({ jobId: outboxId }).catch((error) => console.error("Immediate reminder delivery attempt failed:", error));
    }
    return true;
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === "P2002") return false; // another run already sent this step
    console.error("Invoice reminder enqueue failed:", error);
    return false;
  }
}

/**
 * Drain due invoice reminders across all owners with reminders enabled.
 * Called from the email-outbox cron alongside `processEmailOutbox` and
 * `refreshOverdueInvoices`.
 */
export async function sendDueInvoiceReminders(now: Date = new Date()): Promise<{ sent: number; skipped: number; considered: number }> {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: REMINDABLE_STATUSES },
      // Only the window any step can fall in (3 days before due to 14 after,
      // with slack for time zones and missed runs), so long-overdue invoices
      // that are done reminding never crowd due ones out of the batch.
      dueDate: { gte: new Date(now.getTime() - 30 * DAY_MS), lte: new Date(now.getTime() + 4 * DAY_MS) },
      remindersPaused: false,
      user: { invoiceProfile: { remindersEnabled: true } },
      client: { remindersOptedOut: false, email: { not: null } },
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      userId: true,
      invoiceNumber: true,
      currency: true,
      total: true,
      amountPaid: true,
      dueDate: true,
      status: true,
      remindersPaused: true,
      sentAt: true,
      publicTokenEncrypted: true,
      reminders: { select: { step: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          timeZone: true,
          invoiceProfile: { select: { remindersEnabled: true, reminderSchedule: true, businessName: true } },
        },
      },
      client: { select: { id: true, name: true, email: true, remindersOptedOut: true, remindersUnsubscribeTokenHash: true, remindersUnsubscribeTokenEncrypted: true } },
    },
    take: 500,
  });

  const dailyCounts = new Map<string, number>();
  let sent = 0;
  let skipped = 0;
  const considered = invoices.length;

  for (const invoice of invoices as unknown as ReminderCandidate[]) {
    const eligible = isInvoiceEligibleForReminders({
      status: invoice.status,
      dueDate: invoice.dueDate,
      remindersPaused: invoice.remindersPaused,
      ownerRemindersEnabled: Boolean(invoice.user.invoiceProfile?.remindersEnabled),
      clientEmail: invoice.client?.email || null,
      clientOptedOut: Boolean(invoice.client?.remindersOptedOut),
      sentReminderCount: invoice.reminders.length,
    });
    if (!eligible) { skipped += 1; continue; }

    const schedule = sanitizeReminderSchedule(invoice.user.invoiceProfile?.reminderSchedule);
    const step = selectDueReminderStep({
      dueDate: invoice.dueDate!,
      now,
      timeZone: invoice.user.timeZone,
      enabledSteps: schedule,
      sentSteps: invoice.reminders.map((reminder) => reminder.step),
      invoiceSentAt: invoice.sentAt,
    });
    if (!step) { skipped += 1; continue; }

    let used = dailyCounts.get(invoice.userId);
    if (used === undefined) {
      used = await countRemindersSentTodayForUser(invoice.userId, now);
      dailyCounts.set(invoice.userId, used);
    }
    if (used >= MAX_INVOICE_REMINDERS_PER_USER_PER_DAY) { skipped += 1; continue; }

    const ok = await enqueueReminder(invoice, step);
    if (ok) {
      sent += 1;
      dailyCounts.set(invoice.userId, used + 1);
    } else {
      skipped += 1;
    }
  }

  return { sent, skipped, considered };
}

/**
 * Enqueue the paid-receipt email exactly once, guarded by `paidReceiptSentAt`
 * (claimed inside the same transaction that records the payment). Called
 * from the payment route, not the cron — the trigger is the payment itself.
 */
export async function enqueuePaidReceiptIfEnabled(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: {
    invoiceId: string;
    userId: string;
    invoiceNumber: string;
    currency: string;
    total: string;
    paidDate: Date;
    clientName: string;
    clientEmail: string | null;
  },
): Promise<void> {
  if (!input.clientEmail) return;
  const [profile, owner] = await Promise.all([
    tx.invoiceProfile.findUnique({ where: { userId: input.userId }, select: { paidReceiptEnabled: true, businessName: true } }),
    tx.user.findUnique({ where: { id: input.userId }, select: { name: true, email: true } }),
  ]);
  if (!profile?.paidReceiptEnabled || !owner) return;

  const claimed = await tx.invoice.updateMany({ where: { id: input.invoiceId, paidReceiptSentAt: null }, data: { paidReceiptSentAt: new Date() } });
  if (claimed.count !== 1) return; // already sent, or lost a concurrent race

  await enqueueEmail(
    buildInvoicePaidReceiptEmail({
      to: input.clientEmail,
      clientName: input.clientName,
      invoiceNumber: input.invoiceNumber,
      total: input.total,
      currency: input.currency,
      paidDate: input.paidDate,
      senderName: profile.businessName || owner.name || owner.email,
    }),
    tx,
  );
}
