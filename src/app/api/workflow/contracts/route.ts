import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import {
  buildContractContent,
  type ContractContent,
  assertContractsEnabled,
  CONTRACT_MAX_TITLE_LENGTH,
  getConfiguredEsignProvider,
  normalizeSections,
  sha256,
  stableStringify,
  validatePaymentPlanItem,
} from "@/utils/contracts";

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function serializeListContract(contract: {
  id: string;
  title: string;
  status: string;
  provider: string;
  currency: string;
  governingLaw: string;
  jurisdiction: string | null;
  finalizedAt: Date | null;
  executedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  client: { id: string; name: string; email: string | null };
  project: { id: string; title: string } | null;
  versions: Array<{ version: number; contentHash: string; status: string }>;
  signers: Array<{ role: string; name: string; email: string; status: string; signedAt: Date | null }>;
  paymentPlanItems: Array<{ id: string; label: string; amount: Prisma.Decimal; currency: string; triggerType: string; status: string }>;
}) {
  return {
    id: contract.id,
    title: contract.title,
    status: contract.status,
    provider: contract.provider,
    currency: contract.currency,
    governing_law: contract.governingLaw,
    jurisdiction: contract.jurisdiction,
    finalized_at: contract.finalizedAt,
    executed_at: contract.executedAt,
    created_at: contract.createdAt,
    updated_at: contract.updatedAt,
    client: contract.client,
    project: contract.project,
    current_version: contract.versions[0] || null,
    signers: contract.signers.map((signer) => ({
      role: signer.role,
      name: signer.name,
      email: signer.email,
      status: signer.status,
      signed_at: signer.signedAt,
    })),
    payment_plan: contract.paymentPlanItems.map((item) => ({
      id: item.id,
      label: item.label,
      amount: item.amount.toString(),
      currency: item.currency,
      trigger_type: item.triggerType,
      status: item.status,
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "all";
    const contracts = await prisma.contract.findMany({
      where: {
        userId: session.userId,
        ...(status !== "all" ? { status } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { client: { name: { contains: search, mode: "insensitive" } } },
                { project: { title: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, title: true } },
        versions: { orderBy: { version: "desc" }, take: 1, select: { version: true, contentHash: true, status: true } },
        signers: { orderBy: { sequence: "asc" }, select: { role: true, name: true, email: true, status: true, signedAt: true } },
        paymentPlanItems: { orderBy: { sequence: "asc" }, select: { id: true, label: true, amount: true, currency: true, triggerType: true, status: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, contracts: contracts.map(serializeListContract) });
  } catch (error) {
    console.error("Contracts fetch error:", error);
    return NextResponse.json({ success: false, message: "Unable to load Agreements." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });

    const title = clean(body.title, CONTRACT_MAX_TITLE_LENGTH);
    const clientId = clean(body.clientId ?? body.client_id, 80);
    const projectId = clean(body.projectId ?? body.project_id, 80) || null;
    if (!title) return NextResponse.json({ success: false, message: "Agreement title is required." }, { status: 400 });
    if (!clientId) return NextResponse.json({ success: false, message: "Choose a client before creating an Agreement." }, { status: 400 });

    const [owner, client] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true, currency: true } }),
      prisma.client.findFirst({ where: { id: clientId, userId: session.userId }, select: { id: true, name: true, email: true, company: true, address: true } }),
    ]);
    if (!owner || !client) return NextResponse.json({ success: false, message: "Client not found or unauthorized." }, { status: 404 });

    const project = projectId
      ? await prisma.project.findFirst({ where: { id: projectId, userId: session.userId }, select: { id: true, title: true, description: true, clientId: true, currency: true } })
      : null;
    if (projectId && !project) return NextResponse.json({ success: false, message: "Project not found or unauthorized." }, { status: 404 });
    if (project && project.clientId !== client.id) {
      return NextResponse.json({ success: false, message: "The selected project belongs to a different client." }, { status: 400 });
    }

    const currency = clean(body.currency ?? project?.currency ?? owner.currency ?? "USD", 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ success: false, message: "Use a valid 3-letter Agreement currency." }, { status: 400 });

    const sections = normalizeSections(body.sections, {
      ownerName: owner.name || owner.email,
      clientName: client.name,
    });
    const rawPlan = Array.isArray(body.paymentPlan) ? body.paymentPlan : [];
    if (rawPlan.length > 25) return NextResponse.json({ success: false, message: "An Agreement can have at most 25 payment plan items." }, { status: 400 });
    const plan = rawPlan.map((item, index) => validatePaymentPlanItem(item, index));
    if (plan.some((item) => item.currency !== currency)) {
      return NextResponse.json({ success: false, message: "Every payment must use the Agreement currency." }, { status: 400 });
    }

    const milestoneIds = [...new Set(plan.map((item) => item.milestoneId).filter((id): id is string => Boolean(id)))];
    if (milestoneIds.length && !project) {
      return NextResponse.json({ success: false, message: "Milestone-linked payments require a project." }, { status: 400 });
    }
    if (milestoneIds.length) {
      const milestones = await prisma.milestone.findMany({ where: { id: { in: milestoneIds }, projectId: project!.id }, select: { id: true, dueDate: true } });
      if (milestones.length !== milestoneIds.length) return NextResponse.json({ success: false, message: "One or more payment milestones are invalid for this project." }, { status: 400 });
      const milestoneDates = new Map(milestones.map((milestone) => [milestone.id, milestone.dueDate]));
      for (const item of plan) {
        if (item.triggerType !== "milestone_due" || !item.milestoneId) continue;
        const dueDate = milestoneDates.get(item.milestoneId);
        if (!dueDate) return NextResponse.json({ success: false, message: `The milestone used by “${item.label}” needs a due date before it can trigger an invoice.` }, { status: 400 });
        item.triggerDate = dueDate;
      }
    }

    const governingLaw = clean(body.governingLaw ?? "India", 160) || "India";
    const jurisdiction = clean(body.jurisdiction, 160) || null;
    const ownerName = owner.name || owner.email;

    const created = await prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          userId: owner.id,
          clientId: client.id,
          projectId: project?.id || null,
          title,
          currency,
          governingLaw,
          jurisdiction,
          provider: getConfiguredEsignProvider(),
        },
      });

      await tx.contractSigner.createMany({
        data: [
          { contractId: contract.id, userId: owner.id, role: "owner", sequence: 2, name: ownerName, email: owner.email },
          { contractId: contract.id, clientId: client.id, role: "client", sequence: 1, name: client.name, email: client.email || "" },
        ],
      });

      for (const item of plan) {
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
        title,
        ownerName,
        ownerEmail: owner.email,
        clientName: client.name,
        clientEmail: client.email,
        clientCompany: client.company,
        clientAddress: client.address,
        projectTitle: project?.title || null,
        projectDescription: project?.description || null,
        governingLaw,
        jurisdiction,
        sections,
        currency,
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
          contractId: contract.id,
          version: 1,
          content: content as unknown as Prisma.InputJsonValue,
          contentHash: sha256(stableStringify(content)),
          createdByUserId: owner.id,
        },
      });
      await tx.contractEvent.create({
        data: { contractId: contract.id, versionId: version.id, actorUserId: owner.id, eventType: "contract_created", metadata: { provider: getConfiguredEsignProvider() } },
      });
      if (project) {
        await tx.project.update({
          where: { id: project.id },
          data: {
            contractCoverage: "rive",
            externalContractLabel: null,
            externalContractUrl: null,
            contractDecisionAt: new Date(),
          },
        });
      }
      return { contractId: contract.id, versionId: version.id };
    });

    return NextResponse.json({ success: true, contractId: created.contractId, versionId: created.versionId, message: "Agreement draft created." }, { status: 201 });
  } catch (error) {
    console.error("Contract create error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unable to create Agreement." }, { status: 400 });
  }
}
