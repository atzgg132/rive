import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf, Font } from "@react-pdf/renderer";

// Define styles
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 12, color: "#333" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 40 },
  logo: { fontSize: 24, fontWeight: "bold", color: "#1D4ED8" },
  title: { fontSize: 24, fontWeight: "bold", color: "#333" },
  section: { marginBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottom: "1px solid #E2EAF4", paddingVertical: 8 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", borderBottom: "2px solid #333", paddingVertical: 8, fontWeight: "bold" },
  col1: { width: "40%" },
  col2: { width: "20%", textAlign: "right" },
  col3: { width: "20%", textAlign: "right" },
  col4: { width: "20%", textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, marginTop: 12, borderTop: "2px solid #333" },
  totalText: { fontSize: 14, fontWeight: "bold" },
  muted: { color: "#666", fontSize: 10 }
});

const InvoiceDocument = ({ invoice }: { invoice: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>rive.</Text>
          <Text style={styles.muted}>The Freelance OS</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.title}>INVOICE</Text>
          <Text style={{ marginTop: 8 }}>{invoice.invoice_number}</Text>
          <Text style={styles.muted}>Date: {new Date(invoice.issue_date).toLocaleDateString()}</Text>
          {invoice.due_date && <Text style={styles.muted}>Due: {new Date(invoice.due_date).toLocaleDateString()}</Text>}
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 40 }}>
        <View>
          <Text style={{ fontWeight: "bold", marginBottom: 4 }}>Bill To:</Text>
          <Text>{invoice.client_name || "Private Client"}</Text>
        </View>
        {invoice.project_title && (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontWeight: "bold", marginBottom: 4 }}>Project:</Text>
            <Text>{invoice.project_title}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.rowHeader}>
          <Text style={styles.col1}>Description</Text>
          <Text style={styles.col2}>Qty</Text>
          <Text style={styles.col3}>Price</Text>
          <Text style={styles.col4}>Amount</Text>
        </View>
        {invoice.items && invoice.items.map((item: any, i: number) => (
          <View key={i} style={styles.row}>
            <Text style={styles.col1}>{item.description}</Text>
            <Text style={styles.col2}>{item.quantity}</Text>
            <Text style={styles.col3}>${Number(item.unit_price).toFixed(2)}</Text>
            <Text style={styles.col4}>${Number(item.amount).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <View style={{ width: "50%", alignSelf: "flex-end" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text>Subtotal</Text>
          <Text>${Number(invoice.subtotal).toFixed(2)}</Text>
        </View>
        {Number(invoice.tax_rate) > 0 && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text>Tax ({Number(invoice.tax_rate)}%)</Text>
            <Text>${Number(invoice.tax_amount).toFixed(2)}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalText}>Total Due</Text>
          <Text style={styles.totalText}>${Number(invoice.total).toFixed(2)}</Text>
        </View>
      </View>

      {invoice.notes && (
        <View style={{ marginTop: 40 }}>
          <Text style={{ fontWeight: "bold", marginBottom: 4 }}>Notes:</Text>
          <Text style={styles.muted}>{invoice.notes}</Text>
        </View>
      )}
    </Page>
  </Document>
);

export const downloadInvoicePDF = async (invoice: any) => {
  const blob = await pdf(<InvoiceDocument invoice={invoice} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Invoice_${invoice.invoice_number}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
