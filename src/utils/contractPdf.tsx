import "server-only";

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { ContractContent } from "@/utils/contracts";

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", fontSize: 10, color: "#1E293B", lineHeight: 1.45 },
  header: { marginBottom: 24, borderBottom: "2px solid #1D4ED8", paddingBottom: 14 },
  brand: { fontSize: 10, fontWeight: "bold", color: "#1D4ED8", letterSpacing: 1.5 },
  title: { marginTop: 8, fontSize: 22, fontWeight: "bold", color: "#0C1E36" },
  meta: { marginTop: 5, color: "#64748B", fontSize: 9 },
  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 6 },
  party: { width: "46%" },
  label: { fontSize: 8, fontWeight: "bold", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 },
  partyText: { fontSize: 10, color: "#0F172A" },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", color: "#0F172A", marginBottom: 5 },
  body: { fontSize: 10, color: "#334155" },
  table: { marginTop: 8, border: "1px solid #CBD5E1", borderRadius: 5 },
  row: { flexDirection: "row", borderBottom: "1px solid #E2E8F0", padding: 7 },
  rowLast: { flexDirection: "row", padding: 7 },
  cellLabel: { width: "31%", fontSize: 9, fontWeight: "bold" },
  cell: { width: "23%", fontSize: 9, color: "#334155" },
  small: { marginTop: 5, color: "#64748B", fontSize: 8 },
  evidence: { marginTop: 2, color: "#64748B", fontSize: 7, fontFamily: "Courier" },
  footer: { marginTop: 22, paddingTop: 10, borderTop: "1px solid #CBD5E1", color: "#64748B", fontSize: 8 },
});

function ContractPdfDocument({
  content,
  governingLaw,
  jurisdiction,
  status,
  executedAt,
  documentHash,
  evidenceHash,
  provider,
  signatures,
}: {
  content: ContractContent;
  governingLaw: string;
  jurisdiction: string | null;
  status: string;
  executedAt: string | null;
  documentHash: string;
  evidenceHash: string;
  provider: string;
  signatures: Array<{ id: string; role: string; name: string; email: string; signedAt: string; consentTextVersion: string; providerEventId: string | null; ipHash: string | null; userAgentHash: string | null }>;
}) {
  const enabledSections = content.sections.filter((section) => section.enabled);
  const effectiveGoverningLaw = content.governingLaw || governingLaw;
  const effectiveJurisdiction = content.jurisdiction ?? jurisdiction;
  return (
    <Document title={content.title} author="rive." subject="Freelance services contract">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.brand}>RIVE. CONTRACT RECORD</Text>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.meta}>Status: {status} · Governing law: {effectiveGoverningLaw}{effectiveJurisdiction ? ` · Jurisdiction: ${effectiveJurisdiction}` : ""}</Text>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.label}>Freelancer / owner</Text>
            <Text style={styles.partyText}>{content.ownerName}</Text>
            <Text style={styles.meta}>{content.ownerEmail}</Text>
          </View>
          <View style={styles.party}>
            <Text style={styles.label}>Client</Text>
            <Text style={styles.partyText}>{content.clientName}</Text>
            {content.clientCompany ? <Text style={styles.meta}>{content.clientCompany}</Text> : null}
            {content.clientEmail ? <Text style={styles.meta}>{content.clientEmail}</Text> : null}
            {content.clientAddress ? <Text style={styles.meta}>{content.clientAddress}</Text> : null}
          </View>
        </View>

        {content.projectTitle && content.projectDescription ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Linked project brief</Text>
            <Text style={styles.meta}>{content.projectTitle}</Text>
            <Text style={styles.body}>{content.projectDescription}</Text>
          </View>
        ) : null}

        {enabledSections.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment plan</Text>
          {content.paymentPlan.items.length ? (
            <View style={styles.table}>
              {content.paymentPlan.items.map((item, index) => (
                <View key={item.id} style={index === content.paymentPlan.items.length - 1 ? styles.rowLast : styles.row}>
                  <Text style={styles.cellLabel}>{item.label}</Text>
                  <Text style={styles.cell}>{item.currency} {item.amount}</Text>
                  <Text style={styles.cell}>{formatTrigger(item)}</Text>
                  <Text style={styles.cell}>Due in {item.dueDays} days</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.body}>No automatic payment plan was attached to this contract.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signature record</Text>
          {signatures.length ? signatures.map((signature) => (
            <View key={`${signature.role}-${signature.email}`} style={{ marginBottom: 7 }}>
              <Text style={styles.partyText}>{signature.name} · {signature.role}</Text>
              <Text style={styles.meta}>{signature.email} · signed {new Date(signature.signedAt).toISOString()}</Text>
              <Text style={styles.evidence}>Signature record: {signature.id} · consent {signature.consentTextVersion}</Text>
              {signature.providerEventId ? <Text style={styles.evidence}>Provider event: {signature.providerEventId}</Text> : null}
              {signature.ipHash ? <Text style={styles.evidence}>Network fingerprint (hashed): {signature.ipHash}</Text> : null}
              {signature.userAgentHash ? <Text style={styles.evidence}>Device fingerprint (hashed): {signature.userAgentHash}</Text> : null}
            </View>
          )) : <Text style={styles.body}>No signature has been recorded on this version.</Text>}
        </View>

        <View style={styles.footer}>
          <Text>Document hash: {documentHash}</Text>
          <Text>Evidence hash: {evidenceHash}</Text>
          <Text>Signature provider: {provider}</Text>
          <Text>Executed at: {executedAt || "not executed"}</Text>
          <Text>This record is generated by rive. The parties remain responsible for reviewing the contract, signer authority, identity/authentication, applicable law, and any exclusions or formalities that apply to their transaction.</Text>
        </View>
      </Page>
    </Document>
  );
}

function formatTrigger(item: ContractContent["paymentPlan"]["items"][number]): string {
  if (item.triggerType === "on_signing") return "On signing";
  if (item.triggerType === "fixed_date") return item.triggerDate ? `On ${item.triggerDate.slice(0, 10)}` : "Fixed date";
  if (item.triggerType === "milestone_due") return `${item.milestoneTitle ? `Due: ${item.milestoneTitle}` : "Milestone due"}${item.triggerDate ? ` on ${item.triggerDate.slice(0, 10)}` : ""}`;
  if (item.milestoneTitle) return `Complete: ${item.milestoneTitle}`;
  return item.triggerType.replaceAll("_", " ");
}

export async function renderContractPdf(input: Parameters<typeof ContractPdfDocument>[0]): Promise<Buffer> {
  return renderToBuffer(<ContractPdfDocument {...input} />);
}
