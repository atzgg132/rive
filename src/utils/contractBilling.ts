import "server-only";

import { prisma } from "@/utils/db";
import { addDays, createNotification } from "@/utils/contracts";
import { buildInvoiceReadyEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { nextInvoiceNumber } from "@/utils/invoiceNumber";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

function isEligible(item: {
  triggerType: string;
  triggerDate: Date | null;
  milestone: { dueDate: Date | null; completed: boolean; completedAt: Date | null } | null;
}, now: Date): boolean {
  if (item.triggerType === "on_signing") return true;
  if (item.triggerType === "fixed_date") return Boolean(item.triggerDate && item.triggerDate <= now);
  if (item.triggerType === "milestone_completed") return Boolean(item.milestone?.completed);
  if (item.triggerType === "milestone_due") {
    const agreedDueDate = item.triggerDate || item.milestone?.dueDate;
    return Boolean(agreedDueDate && agreedDueDate <= now);
  }
  return false;
}

function eligibilityDate(item: {
  triggerType: string;
  triggerDate: Date | null;
  milestone: { dueDate: Date | null; completed: boolean; completedAt: Date | null } | null;
}, now: Date): Date {
  if (item.triggerType === "fixed_date" && item.triggerDate) return item.triggerDate;
  if (item.triggerType === "milestone_due") return item.triggerDate || item.milestone?.dueDate || now;
  if (item.triggerType === "milestone_completed" && item.milestone?.completedAt) return item.milestone.completedAt;
  return now;
}

export async function processContractBilling(input: { userId?: string; contractId?: string; limit?: number } = {}) {
  const now = new Date();
  await prisma.contractBillingOccurrence.updateMany({
    where: { status: "processing", updatedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) } },
    data: { status: "eligible", lastError: "Recovered stale billing worker claim." },
  });

  const occurrences = await prisma.contractBillingOccurrence.findMany({
    where: {
      status: { in: ["pending", "eligible"] },
      invoiceId: null,
      contract: { status: "executed", ...(input.userId ? { userId: input.userId } : {}), ...(input.contractId ? { id: input.contractId } : {}) },
    },
    include: {
      paymentPlanItem: { include: { milestone: { select: { dueDate: true, completed: true, completedAt: true } } } },
      contract: { include: { client: { select: { id: true, name: true, email: true } }, project: { select: { id: true, title: true } }, user: { select: { name: true, email: true } } } },
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(input.limit || 100, 1), 500),
  });

  let eligible = 0;
  let drafted = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const occurrence of occurrences) {
    const item = occurrence.paymentPlanItem;
    if (!isEligible(item, now)) continue;
    eligible += 1;
    const eligibleAt = occurrence.eligibleAt || eligibilityDate(item, now);
    const claimed = await prisma.contractBillingOccurrence.updateMany({
      where: { id: occurrence.id, invoiceId: null, status: { in: ["pending", "eligible"] } },
      data: { status: "processing", eligibleAt, lastError: null },
    });
    if (claimed.count !== 1) continue;

    try {
      const { invoice, outboxId } = await prisma.$transaction(async (tx) => {
        const invoiceNumber = await nextInvoiceNumber(tx, occurrence.contract.userId, "RIVE", now);
        const created = await tx.invoice.create({
          data: {
            userId: occurrence.contract.userId,
            clientId: occurrence.contract.clientId,
            projectId: occurrence.contract.projectId,
            invoiceNumber,
            status: "draft",
            currency: item.currency,
            subtotal: item.amount,
            taxRate: 0,
            taxAmount: 0,
            total: item.amount,
            dataOrigin: "user",
            issueDate: now,
            dueDate: addDays(eligibleAt, item.dueDays),
            notes: `Draft generated from accepted Agreement “${occurrence.contract.title}”. Review the Agreement and invoice before sending.`,
          },
        });
        await tx.invoiceItem.create({ data: { invoiceId: created.id, description: item.invoiceDescription || item.label, quantity: 1, unitPrice: item.amount, amount: item.amount, sortOrder: 0 } });
        await tx.contractBillingOccurrence.update({ where: { id: occurrence.id }, data: { status: "draft_created", invoiceId: created.id, draftedAt: now, lastError: null } });
        await tx.contractPaymentPlanItem.update({ where: { id: item.id }, data: { status: "draft_created" } });
        await tx.contractEvent.create({ data: { contractId: occurrence.contract.id, eventType: "billing_draft_created", metadata: { occurrenceId: occurrence.id, invoiceId: created.id, triggerType: item.triggerType } } });
        const invoiceReadyOutboxId = await enqueueEmail(buildInvoiceReadyEmail({ to: occurrence.contract.user.email, clientName: occurrence.contract.client.name, invoiceNumber: created.invoiceNumber, total: created.total.toString(), currency: created.currency, dueDate: created.dueDate }), tx);
        return { invoice: created, outboxId: invoiceReadyOutboxId };
      });
      drafted += 1;
      if (getEmailProvider() !== "disabled") {
        await processEmailOutbox({ jobId: outboxId }).catch((mailError) => {
          console.error("Immediate Agreement invoice-ready email attempt failed:", mailError);
        });
      }
      await recordProductEvent({ userId: occurrence.contract.userId, eventName: PRODUCT_EVENTS.invoiceCreated, module: "invoices", entityType: "invoice", entityId: invoice.id, dataOrigin: "user", properties: { generatedFrom: "agreement_billing" } });
      await createNotification({ userId: occurrence.contract.userId, type: "invoice_review", title: "Draft invoice ready for review", message: `${invoice.invoiceNumber} was generated from ${occurrence.contract.title}.`, href: `/workflow/revenue?invoiceId=${encodeURIComponent(invoice.id)}` }).catch(() => undefined);
    } catch (error) {
      failed += 1;
      failures.push(occurrence.id);
      await prisma.contractBillingOccurrence.update({ where: { id: occurrence.id }, data: { status: "eligible", lastError: error instanceof Error ? error.message.slice(0, 500) : "Invoice generation failed." } }).catch(() => undefined);
    }
  }

  return { checked: occurrences.length, eligible, drafted, failed, failures };
}
