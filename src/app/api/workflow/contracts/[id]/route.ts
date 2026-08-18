import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import {
  buildContractContent,
  type ContractContent,
  assertContractsEnabled,
  CONTRACT_MAX_TITLE_LENGTH,
  normalizeSections,
  resetProjectCoverageIfNoActiveContracts,
  sha256,
  stableStringify,
  transitionContractStatus,
  validatePaymentPlanItem,
} from "@/utils/contracts";
import { getEsignProvider } from "@/utils/esign";

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function getOwnedContract(userId: string, id: string) {
  return prisma.contract.findFirst({
    where: { id, userId },
    include: {
      client: { select: { id: true, name: true, email: true, company: true, address: true } },
      project: { select: { id: true, title: true, currency: true, description: true, milestones: { orderBy: { dueDate: "asc" }, take: 100, select: { id: true, title: true, dueDate: true, completed: true } } } },
      versions: { orderBy: { version: "desc" }, take: 50, include: { artifacts: { orderBy: { generatedAt: "desc" }, take: 5 } } },
      signers: { orderBy: { sequence: "asc" }, include: { signatures: { orderBy: { signedAt: "desc" }, take: 50, select: { id: true, versionId: true, signerRole: true, signerName: true, signerEmail: true, consentAccepted: true, consentTextVersion: true, signedAt: true, providerEventId: true } } } },
      reviewLinks: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, type: true, versionId: true, expiresAt: true, revokedAt: true, createdAt: true } },
      comments: { orderBy: { createdAt: "asc" }, take: 50, select: { id: true, versionId: true, authorRole: true, authorName: true, authorEmail: true, sectionKey: true, body: true, status: true, resolvedAt: true, createdAt: true } },
      events: { orderBy: { createdAt: "desc" }, take: 100, select: { id: true, versionId: true, eventType: true, metadata: true, createdAt: true } },
      paymentPlanItems: { orderBy: { sequence: "asc" }, take: 25, include: { milestone: { select: { id: true, title: true, dueDate: true, completed: true } }, occurrence: { include: { invoice: { select: { id: true, invoiceNumber: true, status: true, total: true } } } } } },
    },
  });
}

function mapContract(contract: NonNullable<Awaited<ReturnType<typeof getOwnedContract>>>) {
  return {
    id: contract.id,
    title: contract.title,
    status: contract.status,
    provider: contract.provider,
    provider_envelope_id: contract.providerEnvelopeId,
    governing_law: contract.governingLaw,
    jurisdiction: contract.jurisdiction,
    currency: contract.currency,
    finalized_at: contract.finalizedAt,
    executed_at: contract.executedAt,
    voided_at: contract.voidedAt,
    void_requested_at: contract.voidRequestedAt,
    void_requested_by_role: contract.voidRequestedByRole,
    void_request_note: contract.voidRequestNote,
    void_confirm_note: contract.voidConfirmNote,
    review_expires_at: contract.reviewExpiresAt,
    created_at: contract.createdAt,
    updated_at: contract.updatedAt,
    client: contract.client,
    project: contract.project,
    versions: contract.versions.map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      content: version.content,
      content_hash: version.contentHash,
      created_at: version.createdAt,
      finalized_at: version.finalizedAt,
      artifacts: version.artifacts.map((artifact) => ({ id: artifact.id, artifact_type: artifact.artifactType, mime_type: artifact.mimeType, content_hash: artifact.contentHash, generated_at: artifact.generatedAt })),
    })),
    signers: contract.signers.map((signer) => ({
      id: signer.id,
      role: signer.role,
      name: signer.name,
      email: signer.email,
      status: signer.status,
      sequence: signer.sequence,
      invited_at: signer.invitedAt,
      signed_at: signer.signedAt,
      signatures: signer.signatures,
    })),
    review_links: contract.reviewLinks,
    comments: contract.comments,
    events: contract.events,
    payment_plan: contract.paymentPlanItems.map((item) => ({
      id: item.id,
      label: item.label,
      amount: item.amount.toString(),
      currency: item.currency,
      trigger_type: item.triggerType,
      trigger_date: item.triggerDate,
      due_days: item.dueDays,
      invoice_description: item.invoiceDescription,
      sequence: item.sequence,
      status: item.status,
      milestone: item.milestone,
      occurrence: item.occurrence ? { id: item.occurrence.id, status: item.occurrence.status, eligible_at: item.occurrence.eligibleAt, drafted_at: item.occurrence.draftedAt, invoice: item.occurrence.invoice ? { ...item.occurrence.invoice, total: item.occurrence.invoice.total.toString() } : null } : null,
    })),
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const contract = await getOwnedContract(session.userId, id);
    if (!contract) return NextResponse.json({ success: false, message: "Agreement not found." }, { status: 404 });
    return NextResponse.json({ success: true, contract: mapContract(contract) });
  } catch (error) {
    console.error("Contract detail fetch error:", error);
    return NextResponse.json({ success: false, message: "Unable to load Agreement." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });

    const existing = await getOwnedContract(session.userId, id);
    if (!existing) return NextResponse.json({ success: false, message: "Agreement not found." }, { status: 404 });
    if (["starting", "signing", "executed", "void"].includes(existing.status)) {
      return NextResponse.json({ success: false, message: "This Agreement is locked because recorded acceptance has started or it has been accepted/voided." }, { status: 409 });
    }
    const owner = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } });
    if (!owner) return NextResponse.json({ success: false, message: "Owner not found." }, { status: 404 });

    const currentVersion = existing.versions[0];
    const currentContent = (currentVersion?.content || {}) as unknown as ContractContent;
    const title = clean(body.title ?? existing.title, CONTRACT_MAX_TITLE_LENGTH);
    if (!title) return NextResponse.json({ success: false, message: "Agreement title is required." }, { status: 400 });
    const currency = clean(body.currency ?? existing.currency, 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ success: false, message: "Use a valid 3-letter Agreement currency." }, { status: 400 });
    const governingLaw = clean(body.governingLaw ?? currentContent.governingLaw ?? existing.governingLaw, 160) || existing.governingLaw;
    const jurisdiction = Object.prototype.hasOwnProperty.call(body, "jurisdiction")
      ? clean(body.jurisdiction, 160) || null
      : currentContent.jurisdiction ?? existing.jurisdiction;
    const sections = normalizeSections(body.sections ?? currentContent.sections, { ownerName: owner.name || owner.email, clientName: existing.client.name });
    const useNewPaymentPlan = Object.prototype.hasOwnProperty.call(body, "paymentPlan");
    const rawPlan = useNewPaymentPlan ? (Array.isArray(body.paymentPlan) ? body.paymentPlan : []) : null;
    if (rawPlan && rawPlan.length > 25) return NextResponse.json({ success: false, message: "An Agreement can have at most 25 payment plan items." }, { status: 400 });
    const plan = rawPlan ? rawPlan.map((item, index) => validatePaymentPlanItem(item, index)) : null;
    if (plan) {
      if (plan.some((item) => item.currency !== currency)) return NextResponse.json({ success: false, message: "Every payment must use the Agreement currency." }, { status: 400 });
      const existingOccurrences = await prisma.contractBillingOccurrence.count({ where: { contractId: id } });
      if (existingOccurrences > 0) return NextResponse.json({ success: false, message: "Payment plans cannot be replaced after an invoice occurrence exists." }, { status: 409 });
      const milestoneIds = [...new Set(plan.map((item) => item.milestoneId).filter((value): value is string => Boolean(value)))];
      if (milestoneIds.length) {
        if (!existing.project) return NextResponse.json({ success: false, message: "Milestone-linked payments require a project." }, { status: 400 });
        const milestones = await prisma.milestone.findMany({ where: { id: { in: milestoneIds }, projectId: existing.project.id }, select: { id: true, dueDate: true } });
        if (milestones.length !== milestoneIds.length) return NextResponse.json({ success: false, message: "One or more payment milestones are invalid for this project." }, { status: 400 });
        const milestoneDates = new Map(milestones.map((milestone) => [milestone.id, milestone.dueDate]));
        for (const item of plan) {
          if (item.triggerType !== "milestone_due" || !item.milestoneId) continue;
          const dueDate = milestoneDates.get(item.milestoneId);
          if (!dueDate) return NextResponse.json({ success: false, message: `The milestone used by “${item.label}” needs a due date before it can trigger an invoice.` }, { status: 400 });
          const previousItem = existing.paymentPlanItems.find((candidate) => candidate.sequence === item.sequence);
          if (!item.triggerDate || previousItem?.milestoneId !== item.milestoneId || previousItem.triggerType !== "milestone_due") item.triggerDate = dueDate;
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (plan) {
        await tx.contractPaymentPlanItem.deleteMany({ where: { contractId: id } });
        for (const item of plan) {
          await tx.contractPaymentPlanItem.create({ data: { contractId: id, milestoneId: item.milestoneId, label: item.label, amount: item.amount, currency: item.currency, triggerType: item.triggerType, triggerDate: item.triggerDate, dueDays: item.dueDays, invoiceDescription: item.invoiceDescription, sequence: item.sequence } });
        }
      }
      const persistedPlan = await tx.contractPaymentPlanItem.findMany({ where: { contractId: id }, include: { milestone: { select: { title: true } } }, orderBy: { sequence: "asc" } });
      const syncProjectSnapshot = body.syncProjectSnapshot === true;
      const content = buildContractContent({
        title,
        ownerName: owner.name || owner.email,
        ownerEmail: owner.email,
        clientName: existing.client.name,
        clientEmail: existing.client.email,
        clientCompany: existing.client.company,
        clientAddress: existing.client.address,
        projectTitle: syncProjectSnapshot ? existing.project?.title ?? null : currentContent.projectTitle ?? existing.project?.title ?? null,
        projectDescription: syncProjectSnapshot ? existing.project?.description ?? null : currentContent.projectDescription ?? existing.project?.description ?? null,
        governingLaw,
        jurisdiction,
        sections,
        currency,
        paymentPlan: persistedPlan.map((item) => ({ id: item.id, label: item.label, amount: item.amount.toString(), currency: item.currency, triggerType: item.triggerType as ContractContent["paymentPlan"]["items"][number]["triggerType"], triggerDate: item.triggerDate?.toISOString() || null, dueDays: item.dueDays, milestoneId: item.milestoneId, milestoneTitle: item.milestone?.title || null, invoiceDescription: item.invoiceDescription, sequence: item.sequence })),
      });
      const versionNumber = (existing.versions[0]?.version || 0) + 1;
      const version = await tx.contractVersion.create({ data: { contractId: id, version: versionNumber, status: "draft", content: content as unknown as Prisma.InputJsonValue, contentHash: sha256(stableStringify(content)), createdByUserId: session.userId } });
      await tx.contractSigner.updateMany({ where: { contractId: id, role: "client" }, data: { clientId: existing.client.id, name: existing.client.name, email: existing.client.email || "", status: "pending", invitedAt: null, signedAt: null, declinedAt: null } });
      await tx.contractSigner.updateMany({ where: { contractId: id, role: "owner" }, data: { userId: session.userId, name: owner.name || owner.email, email: owner.email, status: "pending", invitedAt: null, signedAt: null, declinedAt: null } });
      const saved = await transitionContractStatus(tx, { where: { id, userId: session.userId }, from: existing.status, to: "draft", data: { title, currency, governingLaw, jurisdiction, finalizedAt: null, executedAt: null, providerEnvelopeId: null, reviewExpiresAt: null } });
      if (saved !== 1) throw new Error("The Agreement changed while the new version was being saved. Reload and try again.");
      await tx.contractReviewLink.updateMany({ where: { contractId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.contractEvent.create({ data: { contractId: id, versionId: version.id, actorUserId: session.userId, eventType: "contract_version_created", metadata: { version: versionNumber, projectSnapshotSynced: syncProjectSnapshot } } });
      return version.id;
    });

    return NextResponse.json({ success: true, versionId: updated, message: "A new editable Agreement version was created." });
  } catch (error) {
    console.error("Contract update error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unable to update Agreement." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const contract = await prisma.contract.findFirst({ where: { id, userId: session.userId }, select: { id: true, status: true, providerEnvelopeId: true, projectId: true } });
    if (!contract) return NextResponse.json({ success: false, message: "Agreement not found." }, { status: 404 });
    if (contract.status === "executed") return NextResponse.json({ success: false, message: "An accepted Agreement is retained as evidence and cannot be deleted." }, { status: 409 });
    if (contract.status === "void") return NextResponse.json({ success: true, message: "Agreement is already void." });
    if (contract.status === "signing" && contract.providerEnvelopeId) {
      try {
        await getEsignProvider().voidEnvelope(contract.providerEnvelopeId);
      } catch (error) {
        console.error("Contract provider void error:", error);
        return NextResponse.json({ success: false, message: "The configured provider could not cancel this request. The Agreement remains active; retry after the provider is available." }, { status: 502 });
      }
    }
    await prisma.$transaction(async (tx) => {
      const voided = await transitionContractStatus(tx, { where: { id, userId: session.userId }, from: contract.status, to: "void", data: { voidedAt: new Date() } });
      if (voided !== 1) throw new Error("The Agreement changed while it was being voided. Reload and try again.");
      await tx.contractReviewLink.updateMany({ where: { contractId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.contractEvent.create({ data: { contractId: id, actorUserId: session.userId, eventType: "contract_voided", metadata: { providerEnvelopeId: contract.providerEnvelopeId } } });
      if (contract.projectId) await resetProjectCoverageIfNoActiveContracts(tx, contract.projectId, session.userId);
    });
    return NextResponse.json({ success: true, message: "Agreement voided. Its history is retained." });
  } catch (error) {
    console.error("Contract void error:", error);
    return NextResponse.json({ success: false, message: "Unable to void Agreement." }, { status: 500 });
  }
}
