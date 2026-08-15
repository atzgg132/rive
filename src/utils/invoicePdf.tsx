import "server-only";

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { currencyFractionDigits } from "@/utils/invoiceMath";

export type InvoicePdfSnapshot = {
  version?: number;
  invoiceNumber: string;
  currency: string;
  subtotal: string;
  discountRate?: string;
  discountAmount?: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  outstanding?: string;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  client: { name: string; company: string | null; address: string | null };
  projectTitle: string | null;
  items: Array<{ description: string; quantity: string; unitPrice: string; amount: string }>;
  sender: { name: string; contactName: string | null; email: string; phone: string | null; address: string | null; taxId: string | null; logoUrl?: string | null; paymentInstructions: string | null; defaultTerms: string | null };
};

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", fontSize: 10, color: "#172033" },
  topRule: { height: 6, backgroundColor: "#2563EB", marginBottom: 26 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 20, marginBottom: 28 },
  brand: { fontSize: 21, fontWeight: "bold", color: "#0F172A" },
  brandDot: { color: "#2563EB" },
  sender: { marginTop: 8, color: "#64748B", fontSize: 9, lineHeight: 1.4 },
  title: { fontSize: 24, fontWeight: "bold", color: "#0F172A", textAlign: "right" },
  invoiceNumber: { marginTop: 6, fontSize: 11, color: "#2563EB", textAlign: "right", fontWeight: "bold" },
  meta: { marginTop: 5, color: "#64748B", fontSize: 9, textAlign: "right" },
  parties: { flexDirection: "row", justifyContent: "space-between", gap: 28, padding: 15, backgroundColor: "#F8FAFC", borderRadius: 7, marginBottom: 24 },
  party: { width: "48%" },
  label: { fontSize: 8, fontWeight: "bold", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  partyName: { fontSize: 11, fontWeight: "bold", color: "#0F172A" },
  partyText: { marginTop: 3, fontSize: 9, color: "#475569", lineHeight: 1.35 },
  project: { marginTop: 8, fontSize: 9, color: "#475569" },
  table: { border: "1px solid #CBD5E1", borderRadius: 6, overflow: "hidden" },
  tableHeader: { flexDirection: "row", backgroundColor: "#0F172A", color: "#FFFFFF", padding: 9 },
  row: { flexDirection: "row", padding: 9, borderBottom: "1px solid #E2E8F0" },
  lastRow: { flexDirection: "row", padding: 9 },
  description: { width: "48%" },
  quantity: { width: "16%", textAlign: "right" },
  rate: { width: "18%", textAlign: "right" },
  amount: { width: "18%", textAlign: "right" },
  headerText: { fontSize: 8, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 },
  cellText: { fontSize: 9, color: "#334155" },
  totals: { marginTop: 18, marginLeft: "48%", width: "52%", padding: 12, backgroundColor: "#F8FAFC", borderRadius: 6 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7, fontSize: 9, color: "#475569" },
  grandTotal: { flexDirection: "row", justifyContent: "space-between", borderTop: "1px solid #CBD5E1", paddingTop: 10, marginTop: 4, fontSize: 13, fontWeight: "bold", color: "#0F172A" },
  notes: { marginTop: 26, paddingTop: 13, borderTop: "1px solid #E2E8F0" },
  notesTitle: { fontSize: 8, fontWeight: "bold", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 },
  notesText: { fontSize: 9, color: "#475569", lineHeight: 1.45 },
  footer: { marginTop: 28, paddingTop: 12, borderTop: "1px solid #CBD5E1", fontSize: 8, color: "#64748B", lineHeight: 1.4 },
});

function money(value: string, currency: string): string {
  const digits = currencyFractionDigits(currency);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0);
  } catch {
    return `${currency} ${(Number(value) || 0).toFixed(digits)}`;
  }
}

function date(value: string | null): string {
  if (!value) return "On receipt";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function InvoiceDocument({ invoice }: { invoice: InvoicePdfSnapshot }) {
  const currency = invoice.currency.toUpperCase();
  const outstanding = invoice.outstanding ?? String(Math.max(Number(invoice.total) - Number(invoice.amountPaid), 0));
  return (
    <Document title={`Invoice ${invoice.invoiceNumber}`} author={invoice.sender.name} subject="Invoice">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.topRule} />
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>rive<Text style={styles.brandDot}>.</Text></Text>
            <Text style={styles.sender}>{invoice.sender.name}{invoice.sender.contactName ? `\n${invoice.sender.contactName}` : ""}{invoice.sender.email ? `\n${invoice.sender.email}` : ""}{invoice.sender.phone ? `\n${invoice.sender.phone}` : ""}{invoice.sender.address ? `\n${invoice.sender.address}` : ""}</Text>
          </View>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <Text style={styles.meta}>Issued {date(invoice.issueDate)}</Text>
            <Text style={styles.meta}>Due {date(invoice.dueDate)}</Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.label}>Bill to</Text>
            <Text style={styles.partyName}>{invoice.client.name}</Text>
            {invoice.client.company ? <Text style={styles.partyText}>{invoice.client.company}</Text> : null}
            {invoice.client.address ? <Text style={styles.partyText}>{invoice.client.address}</Text> : null}
          </View>
          <View style={styles.party}>
            <Text style={styles.label}>Project</Text>
            <Text style={styles.partyName}>{invoice.projectTitle || "General services"}</Text>
            <Text style={styles.project}>Currency: {currency}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}><Text style={[styles.description, styles.headerText]}>Description</Text><Text style={[styles.quantity, styles.headerText]}>Qty</Text><Text style={[styles.rate, styles.headerText]}>Rate</Text><Text style={[styles.amount, styles.headerText]}>Amount</Text></View>
          {invoice.items.map((item, index) => <View key={`${item.description}-${index}`} style={index === invoice.items.length - 1 ? styles.lastRow : styles.row}><Text style={[styles.description, styles.cellText]}>{item.description}</Text><Text style={[styles.quantity, styles.cellText]}>{item.quantity}</Text><Text style={[styles.rate, styles.cellText]}>{money(item.unitPrice, currency)}</Text><Text style={[styles.amount, styles.cellText]}>{money(item.amount, currency)}</Text></View>)}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalLine}><Text>Subtotal</Text><Text>{money(invoice.subtotal, currency)}</Text></View>
          {Number(invoice.discountAmount || 0) > 0 ? <View style={styles.totalLine}><Text>Discount{Number(invoice.discountRate || 0) > 0 ? ` (${invoice.discountRate}%)` : ""}</Text><Text>-{money(invoice.discountAmount || "0", currency)}</Text></View> : null}
          {Number(invoice.taxRate) > 0 ? <View style={styles.totalLine}><Text>Tax ({invoice.taxRate}%)</Text><Text>{money(invoice.taxAmount, currency)}</Text></View> : null}
          <View style={styles.grandTotal}><Text>Total</Text><Text>{money(invoice.total, currency)}</Text></View>
          {Number(invoice.amountPaid) > 0 ? <View style={[styles.totalLine, { marginTop: 9 }]}><Text>Paid</Text><Text>{money(invoice.amountPaid, currency)}</Text></View> : null}
          <View style={[styles.totalLine, { fontWeight: "bold", color: "#0F172A", marginBottom: 0 }]}><Text>Amount due</Text><Text>{money(outstanding, currency)}</Text></View>
        </View>

        {invoice.notes || invoice.sender.paymentInstructions || invoice.sender.defaultTerms ? <View style={styles.notes}><Text style={styles.notesTitle}>Notes & payment information</Text><Text style={styles.notesText}>{[invoice.notes, invoice.sender.paymentInstructions, invoice.sender.defaultTerms].filter(Boolean).join("\n\n")}</Text></View> : null}
        <View style={styles.footer}><Text>Thank you for your business. Verify payment details with the sender before transferring funds.</Text>{invoice.sender.taxId ? <Text>Tax ID: {invoice.sender.taxId}</Text> : null}<Text>Generated by rive. · {invoice.invoiceNumber}</Text></View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoice: InvoicePdfSnapshot): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={invoice} />);
}
