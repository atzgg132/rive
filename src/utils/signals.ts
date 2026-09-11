/**
 * Dashboard signals: things that happened TO the workspace, not things the
 * owner did in it. A creation log mirrors the user's own clicks back at them;
 * a signal is an outside event worth opening the app for — a client opening an
 * invoice, cash landing, an invoice going overdue, an agreement moving, a new
 * portfolio enquiry.
 */

export type DashboardSignalTone = "primary" | "info" | "success" | "warning" | "destructive";

export type DashboardSignal = {
  kind: string;
  /** Badge tone — maps onto the shared Badge variants. */
  tone: DashboardSignalTone;
  /** Short badge label — "Opened", "Payment", "Enquiry". */
  tag: string;
  title: string;
  detail: string;
  /** Money attached to the signal (payment events), in `currency`. */
  amount: number | null;
  currency: string | null;
  href: string;
  /** ISO timestamp, used for sorting and display. */
  at: string;
};

export type SignalInvoiceEventRow = {
  eventType: string;
  createdAt: Date | string;
  metadata?: unknown;
  invoice: {
    id: string;
    invoiceNumber: string;
    currency: string;
    client: { name: string } | null;
  } | null;
};

export type SignalContractEventRow = {
  eventType: string;
  createdAt: Date | string;
  metadata?: unknown;
  contract: { id: string; title: string } | null;
};

export type SignalInquiryRow = {
  id: string;
  name: string;
  projectType: string | null;
  sourceProjectTitle: string | null;
  createdAt: Date | string;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function metadataField(metadata: unknown, field: string): unknown {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return (metadata as Record<string, unknown>)[field] ?? null;
}

function metadataAmount(metadata: unknown): number | null {
  const amount = Number(metadataField(metadata, "amount"));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function signalFromInvoiceEvent(row: SignalInvoiceEventRow): DashboardSignal | null {
  const invoice = row.invoice;
  if (!invoice) return null;
  const href = `/workflow/revenue?invoiceId=${encodeURIComponent(invoice.id)}`;
  const client = invoice.client?.name || "A client";
  const at = iso(row.createdAt);
  const currency = invoice.currency;
  const amount = metadataAmount(row.metadata);

  switch (row.eventType) {
    case "viewed":
      return { kind: "invoice_viewed", tone: "info", tag: "Opened", title: `${client} opened ${invoice.invoiceNumber}`, detail: "They have seen the invoice.", amount: null, currency, href, at };
    case "payment_recorded":
      return { kind: "payment_recorded", tone: "success", tag: "Payment", title: `Part payment on ${invoice.invoiceNumber}`, detail: `${client} · partial payment`, amount, currency, href, at };
    case "paid":
      return { kind: "invoice_paid", tone: "success", tag: "Paid", title: `${invoice.invoiceNumber} paid in full`, detail: client, amount, currency, href, at };
    case "overdue":
      return { kind: "invoice_overdue", tone: "warning", tag: "Overdue", title: `${invoice.invoiceNumber} went overdue`, detail: `${client} · chase it from Revenue`, amount: null, currency, href, at };
    default:
      return null;
  }
}

export function signalFromContractEvent(row: SignalContractEventRow): DashboardSignal | null {
  const contract = row.contract;
  if (!contract) return null;
  const href = `/workflow/contracts/${contract.id}`;
  const at = iso(row.createdAt);
  /* `signer_signed` fires for the owner's own signature too — a self-action is
     not a signal, so only the client role passes through. */
  const role = metadataField(row.metadata, "role");

  switch (row.eventType) {
    case "signer_signed":
      if (role !== "client") return null;
      return { kind: "contract_signed", tone: "success", tag: "Signed", title: `${contract.title} signed by your client`, detail: "Agreement acceptance is moving.", amount: null, currency: null, href, at };
    case "signer_declined":
      if (role !== "client") return null;
      return { kind: "contract_declined", tone: "destructive", tag: "Declined", title: `${contract.title} was declined`, detail: "Your client requested changes.", amount: null, currency: null, href, at };
    case "client_comment_added":
      return { kind: "contract_comment", tone: "info", tag: "Comment", title: `New comment on ${contract.title}`, detail: "Your client wrote back in review.", amount: null, currency: null, href, at };
    case "client_review_approved":
      return { kind: "contract_approved", tone: "success", tag: "Approved", title: `${contract.title} approved in review`, detail: "Ready to move to acceptance.", amount: null, currency: null, href, at };
    case "contract_executed":
      return { kind: "contract_executed", tone: "success", tag: "Executed", title: `${contract.title} fully signed`, detail: "The agreement is in force.", amount: null, currency: null, href, at };
    default:
      return null;
  }
}

export function signalFromInquiry(row: SignalInquiryRow): DashboardSignal {
  return {
    kind: "portfolio_inquiry",
    tone: "primary",
    tag: "Enquiry",
    title: `New enquiry from ${row.name}`,
    detail: row.sourceProjectTitle ? `While reading ${row.sourceProjectTitle}` : row.projectType || "From your portfolio",
    amount: null,
    currency: null,
    href: "/portfolio?tab=inquiries",
    at: iso(row.createdAt),
  };
}

/** One merged feed, newest first — bounded, no per-source sections. */
export function mergeSignals(candidates: Array<DashboardSignal | null>, limit = 10): DashboardSignal[] {
  return candidates
    .filter((signal): signal is DashboardSignal => signal !== null)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);
}
