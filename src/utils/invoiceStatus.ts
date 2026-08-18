/**
 * Presentation rules for invoice status, shared by the revenue table, the
 * detail panel, and the attention queue. These were duplicated as local
 * helpers, which is how `voided` ended up styled as an error in one place and
 * unstyled in another.
 */

export type InvoiceStatusTone = "paid" | "open" | "late" | "closed" | "draft";

const TONE_BY_STATUS: Record<string, InvoiceStatusTone> = {
  draft: "draft",
  sent: "open",
  viewed: "open",
  partially_paid: "open",
  paid: "paid",
  overdue: "late",
  voided: "closed",
  cancelled: "closed",
};

const CLASS_BY_TONE: Record<InvoiceStatusTone, string> = {
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300",
  open: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300",
  late: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300",
  closed: "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  draft: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
};

const LABEL_BY_STATUS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partly paid",
  paid: "Paid",
  overdue: "Overdue",
  voided: "Voided",
  cancelled: "Cancelled",
};

export function invoiceStatusTone(status: string): InvoiceStatusTone {
  return TONE_BY_STATUS[status] || "draft";
}

export function invoiceStatusClass(status: string): string {
  return CLASS_BY_TONE[invoiceStatusTone(status)];
}

export function invoiceStatusLabel(status: string): string {
  return LABEL_BY_STATUS[status] || status.replaceAll("_", " ");
}

/** Statuses the payment endpoint will accept a payment against. */
export function canRecordPayment(status: string): boolean {
  return ["sent", "viewed", "overdue", "partially_paid"].includes(status);
}

/** Statuses the send endpoint will issue from. */
export function canSendInvoice(status: string): boolean {
  return ["draft", "overdue"].includes(status);
}

/** The void endpoint refuses anything already closed or partly collected. */
export function canVoidInvoice(status: string, amountPaid: number): boolean {
  return amountPaid <= 0 && ["draft", "sent", "viewed", "overdue"].includes(status);
}

/** Human phrasing for the invoice activity timeline. */
export function invoiceEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    created: "Invoice created",
    sent: "Sent to client",
    viewed: "Opened by client",
    payment_recorded: "Payment recorded",
    paid: "Paid in full",
    voided: "Voided",
    reminder_sent: "Reminder sent",
  };
  return labels[eventType] || eventType.replaceAll("_", " ");
}
