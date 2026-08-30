import "server-only";

import { Prisma } from "@prisma/client";
import {
  buildContractContent,
  type ContractContent,
  type ContractSection,
  getConfiguredEsignProvider,
  sha256,
  stableStringify,
} from "@/utils/contracts";

export type AgreementDraftParty = {
  id: string;
  name: string;
  email: string | null;
  company?: string | null;
  address?: string | null;
};

export type AgreementDraftProject = {
  id: string;
  title: string;
  description: string | null;
};

export type AgreementDraftPayment = {
  milestoneId: string | null;
  label: string;
  amount: number;
  currency: string;
  triggerType: string;
  triggerDate: Date | null;
  dueDays: number;
  invoiceDescription: string | null;
  sequence: number;
};

export type CreateAgreementDraftInput = {
  contractId?: string;
  versionId?: string;
  owner: AgreementDraftParty & { email: string };
  client: AgreementDraftParty;
  project: AgreementDraftProject | null;
  title: string;
  currency: string;
  governingLaw: string;
  jurisdiction: string | null;
  sections: ContractSection[];
  paymentPlan: AgreementDraftPayment[];
};

/**
 * Persist the private, editable first version of an Agreement. This is shared
 * by the full composer and the start-engagement orchestration so both paths
 * produce the same signer, content-hash, event, and project-coverage graph.
 */
export async function createAgreementDraft(
  tx: Prisma.TransactionClient,
  input: CreateAgreementDraftInput,
): Promise<{ contractId: string; versionId: string }> {
  const provider = getConfiguredEsignProvider();
  const ownerName = input.owner.name || input.owner.email;
  const contract = await tx.contract.create({
    data: {
      ...(input.contractId ? { id: input.contractId } : {}),
      userId: input.owner.id,
      clientId: input.client.id,
      projectId: input.project?.id || null,
      title: input.title,
      currency: input.currency,
      governingLaw: input.governingLaw,
      jurisdiction: input.jurisdiction,
      provider,
    },
  });

  await tx.contractSigner.createMany({
    data: [
      {
        contractId: contract.id,
        userId: input.owner.id,
        role: "owner",
        sequence: 2,
        name: ownerName,
        email: input.owner.email,
      },
      {
        contractId: contract.id,
        clientId: input.client.id,
        role: "client",
        sequence: 1,
        name: input.client.name,
        email: input.client.email || "",
      },
    ],
  });

  for (const item of input.paymentPlan) {
    await tx.contractPaymentPlanItem.create({
      data: {
        contractId: contract.id,
        milestoneId: item.milestoneId,
        label: item.label,
        amount: item.amount,
        currency: item.currency,
        triggerType: item.triggerType,
        triggerDate: item.triggerDate,
        dueDays: item.dueDays,
        invoiceDescription: item.invoiceDescription,
        sequence: item.sequence,
      },
    });
  }

  const persistedPlan = await tx.contractPaymentPlanItem.findMany({
    where: { contractId: contract.id },
    include: { milestone: { select: { title: true } } },
    orderBy: { sequence: "asc" },
  });
  const content = buildContractContent({
    title: input.title,
    ownerName,
    ownerEmail: input.owner.email,
    clientName: input.client.name,
    clientEmail: input.client.email,
    clientCompany: input.client.company,
    clientAddress: input.client.address,
    projectTitle: input.project?.title || null,
    projectDescription: input.project?.description || null,
    governingLaw: input.governingLaw,
    jurisdiction: input.jurisdiction,
    sections: input.sections,
    currency: input.currency,
    paymentPlan: persistedPlan.map((item) => ({
      id: item.id,
      label: item.label,
      amount: item.amount.toString(),
      currency: item.currency,
      triggerType: item.triggerType as ContractContent["paymentPlan"]["items"][number]["triggerType"],
      triggerDate: item.triggerDate?.toISOString() || null,
      dueDays: item.dueDays,
      milestoneId: item.milestoneId,
      milestoneTitle: item.milestone?.title || null,
      invoiceDescription: item.invoiceDescription,
      sequence: item.sequence,
    })),
  });
  const version = await tx.contractVersion.create({
    data: {
      ...(input.versionId ? { id: input.versionId } : {}),
      contractId: contract.id,
      version: 1,
      content: content as unknown as Prisma.InputJsonValue,
      contentHash: sha256(stableStringify(content)),
      createdByUserId: input.owner.id,
    },
  });
  await tx.contractEvent.create({
    data: {
      contractId: contract.id,
      versionId: version.id,
      actorUserId: input.owner.id,
      eventType: "contract_created",
      metadata: { provider },
    },
  });
  if (input.project) {
    await tx.project.update({
      where: { id: input.project.id },
      data: {
        contractCoverage: "rive",
        externalContractLabel: null,
        externalContractUrl: null,
        contractDecisionAt: new Date(),
      },
    });
  }
  return { contractId: contract.id, versionId: version.id };
}
