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
  paid: "border-success/25 bg-success/10 text-success dark:border-success/30 dark:bg-success/[0.16]",
  open: "border-info/25 bg-info/10 text-info dark:border-info/30 dark:bg-info/[0.16]",
  late: "border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/[0.16]",
  closed: "border-border bg-muted text-muted-foreground",
  draft: "border-border bg-muted text-muted-foreground",
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

const CLASS_BY_STATUS: Record<string, string> = {
  partially_paid: "border-warning/25 bg-warning/10 text-warning dark:border-warning/30 dark:bg-warning/[0.16]",
};

export function invoiceStatusClass(status: string): string {
  return CLASS_BY_STATUS[status] || CLASS_BY_TONE[invoiceStatusTone(status)];
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
