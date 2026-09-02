import "server-only";

import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { isDateOnly } from "@/utils/calendar";
import { contractsAvailable, createDefaultContractSections } from "@/utils/contracts";
import { createAgreementDraft } from "@/utils/contractDraft";
import { prisma } from "@/utils/db";
import { nextInvoiceNumber } from "@/utils/invoiceNumber";

export type StartEngagementInput = {
  flowId: string;
  entryPoint: "onboarding" | "workspace" | "inquiry";
  sessionId: string | null;
  client:
    | { mode: "existing"; id: string }
    | { mode: "new"; name: string; email: string | null };
  project: { title: string; scope: string | null };
  milestone: { title: string; dueDate: Date; dateOnly: string } | null;
  scopeMode: "project" | "agreement";
  invoice: { amount: number; dueDate: Date; dateOnly: string } | null;
  sourceInquiryId: string | null;
  followUpTaskTitle: string | null;
};

export type StartEngagementRecords = {
  clientId: string;
  projectId: string;
  milestoneId?: string;
  taskId?: string;
  contractId?: string;
  invoiceId?: string;
};

export type StartEngagementResult = {
  records: StartEngagementRecords;
  nextAction: {
    kind: "agreement_review" | "invoice_review" | "milestone_plan" | "inquiry_project";
    href: string;
    label: string;
  };
  createdClient: boolean;
  replayed?: boolean;
};

export type PortfolioInquiryConversionResult = {
  records: { clientId: string; taskId: string };
  nextAction: {
    kind: "inquiry_engagement";
    href: string;
    label: string;
  };
  createdClient: boolean;
  replayed?: boolean;
};

export class EngagementInputError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function engagementFlowAvailable(): boolean {
  return process.env.ENGAGEMENT_FLOW_ENABLED !== "false";
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dateOnly(value: unknown, label: string, code: string): { dateOnly: string; date: Date } {
  const normalized = clean(value, 10);
  if (!isDateOnly(normalized)) {
    throw new EngagementInputError(`${label} must be a valid date.`, code);
  }
  return { dateOnly: normalized, date: new Date(`${normalized}T12:00:00Z`) };
}

export function parseStartEngagementInput(value: unknown): StartEngagementInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EngagementInputError("A valid engagement request is required.", "invalid_payload");
  }
  const body = value as Record<string, unknown>;
  const flowId = clean(body.flowId, 80);
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(flowId)) {
    throw new EngagementInputError("This engagement request needs a valid flow ID.", "invalid_flow_id");
  }
  const entryPoint = body.entryPoint === "onboarding"
    ? "onboarding"
    : body.entryPoint === "workspace"
      ? "workspace"
      : body.entryPoint === "inquiry"
        ? "inquiry"
        : null;
  if (!entryPoint) throw new EngagementInputError("Choose a valid engagement entry point.", "invalid_entry_point");
  const sourceInquiryId = entryPoint === "inquiry"
    ? clean(body.sourceInquiryId ?? body.source_inquiry_id, 80) || null
    : null;
  if (entryPoint === "inquiry" && !sourceInquiryId) {
    throw new EngagementInputError("This engagement request needs its source enquiry.", "missing_source_inquiry");
  }

  const rawClient = body.client;
  if (!rawClient || typeof rawClient !== "object" || Array.isArray(rawClient)) {
    throw new EngagementInputError("Choose or add a client.", "invalid_client");
  }
  const clientValue = rawClient as Record<string, unknown>;
  let client: StartEngagementInput["client"];
  if (clientValue.mode === "existing") {
    const id = clean(clientValue.id, 80);
    if (!id) throw new EngagementInputError("Choose an existing client.", "missing_client");
    client = { mode: "existing", id };
  } else if (clientValue.mode === "new") {
    const name = clean(clientValue.name, 160);
    const email = clean(clientValue.email, 320).toLowerCase() || null;
    if (!name) throw new EngagementInputError("Client name is required.", "missing_client_name");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      throw new EngagementInputError("Use a valid client email.", "invalid_client_email");
    }
    client = { mode: "new", name, email };
  } else {
    throw new EngagementInputError("Choose or add a client.", "invalid_client_mode");
  }

  const rawProject = body.project;
  if (!rawProject || typeof rawProject !== "object" || Array.isArray(rawProject)) {
    throw new EngagementInputError("Project details are required.", "invalid_project");
  }
  const projectValue = rawProject as Record<string, unknown>;
  const projectTitle = clean(projectValue.title, 180);
  if (!projectTitle) throw new EngagementInputError("Project name is required.", "missing_project_name");
  const projectScope = clean(projectValue.scope, 20_000) || null;
  if (entryPoint === "inquiry" && !projectScope) {
    throw new EngagementInputError("Add your working scope before starting this enquiry engagement.", "missing_project_scope");
  }

  const rawMilestone = body.milestone;
  if (!rawMilestone || typeof rawMilestone !== "object" || Array.isArray(rawMilestone)) {
    throw new EngagementInputError("First milestone details are required.", "invalid_milestone");
  }
  const milestoneValue = rawMilestone as Record<string, unknown>;
  const milestoneTitle = clean(milestoneValue.title, 180);
  if (!milestoneTitle) throw new EngagementInputError("First milestone is required.", "missing_milestone");
  const milestoneDate = dateOnly(milestoneValue.dueDate, "Milestone due date", "invalid_milestone_due_date");

  const scopeMode = body.scopeMode === "agreement" ? "agreement" : body.scopeMode === "project" ? "project" : null;
  if (!scopeMode) throw new EngagementInputError("Choose how to keep the scope.", "invalid_scope_mode");

  let invoice: StartEngagementInput["invoice"] = null;
  if (body.invoice !== undefined && body.invoice !== null) {
    if (typeof body.invoice !== "object" || Array.isArray(body.invoice)) {
      throw new EngagementInputError("Invoice details are invalid.", "invalid_invoice");
    }
    const invoiceValue = body.invoice as Record<string, unknown>;
    const amount = Number(invoiceValue.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      throw new EngagementInputError("Invoice amount must be positive.", "invalid_invoice_amount");
    }
    const invoiceDate = dateOnly(invoiceValue.dueDate, "Invoice due date", "invalid_invoice_due_date");
    if (invoiceDate.dateOnly < new Date().toISOString().slice(0, 10)) {
      throw new EngagementInputError("Invoice due date cannot be before today.", "invalid_invoice_due_date");
    }
    invoice = { amount: Math.round(amount * 100) / 100, dueDate: invoiceDate.date, dateOnly: invoiceDate.dateOnly };
  }

  return {
    flowId,
    entryPoint,
    sessionId: clean(body.sessionId, 100) || null,
    client,
    project: { title: projectTitle, scope: projectScope },
    milestone: { title: milestoneTitle, dueDate: milestoneDate.date, dateOnly: milestoneDate.dateOnly },
    scopeMode,
    invoice,
    sourceInquiryId,
    followUpTaskTitle: null,
  };
}

export type InquiryConversionInput = {
  client:
    | { mode: "existing"; id: string }
    | { mode: "new"; name: string; email: string | null };
};

export function parseInquiryConversionInput(value: unknown): InquiryConversionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EngagementInputError("A valid enquiry conversion request is required.", "invalid_payload");
  }
  const body = value as Record<string, unknown>;
  const rawClient = body.client;
  if (!rawClient || typeof rawClient !== "object" || Array.isArray(rawClient)) {
    throw new EngagementInputError("Choose or add a client.", "invalid_client");
  }
  const clientValue = rawClient as Record<string, unknown>;
  let client: InquiryConversionInput["client"];
  if (clientValue.mode === "existing") {
    const id = clean(clientValue.id, 80);
    if (!id) throw new EngagementInputError("Choose an existing client.", "missing_client");
    client = { mode: "existing", id };
  } else if (clientValue.mode === "new") {
    const name = clean(clientValue.name, 160);
    const email = clean(clientValue.email, 320).toLowerCase() || null;
    if (!name) throw new EngagementInputError("Client name is required.", "missing_client_name");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      throw new EngagementInputError("Use a valid client email.", "invalid_client_email");
    }
    client = { mode: "new", name, email };
  } else {
    throw new EngagementInputError("Choose or add a client.", "invalid_client_mode");
  }

  return { client };
}

function deterministicId(userId: string, flowId: string, kind: string): string {
  const hex = crypto.createHash("sha256").update(`${userId}:${flowId}:${kind}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function recordIds(userId: string, flowId: string) {
  return {
    clientId: deterministicId(userId, flowId, "client"),
    projectId: deterministicId(userId, flowId, "project"),
    milestoneId: deterministicId(userId, flowId, "milestone"),
    taskId: deterministicId(userId, flowId, "task"),
    contractId: deterministicId(userId, flowId, "contract"),
    versionId: deterministicId(userId, flowId, "contract-version"),
    invoiceId: deterministicId(userId, flowId, "invoice"),
  };
}

function inquiryFlowId(inquiryId: string): string {
  return `inquiry-${inquiryId}`;
}

function idsForInput(userId: string, input: StartEngagementInput): ReturnType<typeof recordIds> {
  return input.entryPoint === "inquiry" && input.sourceInquiryId
    ? recordIds(userId, inquiryFlowId(input.sourceInquiryId))
    : recordIds(userId, input.flowId);
}

function inquiryConversionNextAction(inquiryId: string): PortfolioInquiryConversionResult["nextAction"] {
  return {
    kind: "inquiry_engagement",
    href: `/workflow/start-engagement?inquiryId=${encodeURIComponent(inquiryId)}`,
    label: "Start the engagement",
  };
}

function nextAction(input: StartEngagementInput, records: StartEngagementRecords): StartEngagementResult["nextAction"] {
  if (input.entryPoint === "inquiry") {
    return {
      kind: "inquiry_project",
      href: `/workflow/projects/${records.projectId}?from=inquiry&inquiryId=${encodeURIComponent(input.sourceInquiryId || "")}`,
      label: "Review the Project",
    };
  }
  if (records.contractId) {
    const nextInvoice = records.invoiceId ? `&nextInvoiceId=${encodeURIComponent(records.invoiceId)}` : "";
    return {
      kind: "agreement_review",
      href: `/workflow/contracts/${records.contractId}?from=engagement&edit=1${nextInvoice}`,
      label: "Review Agreement draft",
    };
  }
  if (records.invoiceId) {
    return {
      kind: "invoice_review",
      href: `/workflow/invoices/new?invoiceId=${encodeURIComponent(records.invoiceId)}&from=engagement`,
      label: "Review invoice draft",
    };
  }
  return {
    kind: "milestone_plan",
    href: `/workflow/projects/${records.projectId}?from=engagement&milestoneId=${encodeURIComponent(records.milestoneId || "")}`,
    label: `Plan ${input.milestone?.title || "milestone"}`,
  };
}

async function readCommittedEngagement(
  userId: string,
  input: StartEngagementInput,
  ids: ReturnType<typeof recordIds>,
): Promise<StartEngagementResult | null> {
  const project = await prisma.project.findFirst({
    where: { id: ids.projectId, userId },
    select: {
      id: true,
      clientId: true,
      sourceInquiryId: true,
      milestones: { where: { id: ids.milestoneId }, select: { id: true } },
      tasks: { where: { id: ids.taskId }, select: { id: true, sourceInquiryId: true } },
      contracts: { where: { id: ids.contractId }, select: { id: true } },
      invoices: { where: { id: ids.invoiceId }, select: { id: true } },
    },
  });
  if (!project) return null;
  if (input.entryPoint === "inquiry") {
    if (
      project.sourceInquiryId !== input.sourceInquiryId ||
      project.tasks.length !== 1 ||
      project.tasks[0].sourceInquiryId !== input.sourceInquiryId ||
      project.milestones.length !== 1
    ) {
      throw new EngagementInputError("The prior enquiry conversion is incomplete.", "idempotency_conflict", 409);
    }
    if (input.client.mode !== "existing" || project.clientId !== input.client.id) {
      throw new EngagementInputError("This enquiry was already converted to another client.", "idempotency_conflict", 409);
    }
    const contractId = project.contracts[0]?.id;
    const invoiceId = project.invoices[0]?.id;
    if ((input.scopeMode === "agreement") !== Boolean(contractId) || Boolean(input.invoice) !== Boolean(invoiceId)) {
      throw new EngagementInputError("This enquiry was already used for different engagement options.", "idempotency_conflict", 409);
    }
    const records: StartEngagementRecords = {
      clientId: project.clientId || "",
      projectId: project.id,
      milestoneId: project.milestones[0].id,
      taskId: project.tasks[0].id,
      ...(contractId ? { contractId } : {}),
      ...(invoiceId ? { invoiceId } : {}),
    };
    return { records, nextAction: nextAction(input, records), createdClient: false, replayed: true };
  }
  if (project.milestones.length !== 1) throw new EngagementInputError("The prior engagement request is incomplete.", "idempotency_conflict", 409);
  if (input.client.mode === "existing" && project.clientId !== input.client.id) {
    throw new EngagementInputError("This flow ID was already used with another client.", "idempotency_conflict", 409);
  }
  const contractId = project.contracts[0]?.id;
  const invoiceId = project.invoices[0]?.id;
  if ((input.scopeMode === "agreement") !== Boolean(contractId) || Boolean(input.invoice) !== Boolean(invoiceId)) {
    throw new EngagementInputError("This flow ID was already used for different engagement options.", "idempotency_conflict", 409);
  }
  const records: StartEngagementRecords = {
    clientId: project.clientId || "",
    projectId: project.id,
    milestoneId: project.milestones[0].id,
    ...(contractId ? { contractId } : {}),
    ...(invoiceId ? { invoiceId } : {}),
  };
  return { records, nextAction: nextAction(input, records), createdClient: input.client.mode === "new", replayed: true };
}

export async function createClientEngagement(userId: string, input: StartEngagementInput): Promise<StartEngagementResult> {
  if (!engagementFlowAvailable()) throw new EngagementInputError("Start engagement is not enabled in this environment.", "feature_disabled", 404);
  if (input.scopeMode === "agreement" && !contractsAvailable()) {
    throw new EngagementInputError("Agreements are not available right now. Keep the scope with the project instead.", "agreements_unavailable", 503);
  }
  let inquiryClientId: string | null = null;
  if (input.entryPoint === "inquiry") {
    if (!input.sourceInquiryId) throw new EngagementInputError("This enquiry conversion is missing its source.", "missing_source_inquiry");
    const inquiry = await prisma.portfolioInquiry.findFirst({
      where: { id: input.sourceInquiryId, userId },
      select: { id: true, status: true, clientId: true, convertedAt: true },
    });
    if (!inquiry) throw new EngagementInputError("Enquiry not found or unauthorized.", "inquiry_not_found", 404);
    if (inquiry.status === "spam") throw new EngagementInputError("Restore this enquiry before converting it.", "inquiry_spam", 409);
    if (!inquiry.convertedAt || !inquiry.clientId) {
      throw new EngagementInputError("Convert this enquiry to a Client before starting the engagement.", "inquiry_conversion_required", 409);
    }
    if (input.client.mode !== "existing" || input.client.id !== inquiry.clientId) {
      throw new EngagementInputError("This enquiry is locked to its converted Client.", "inquiry_client_locked", 409);
    }
    inquiryClientId = inquiry.clientId;
  }
  const ids = idsForInput(userId, input);
  const prior = await readCommittedEngagement(userId, input, ids);
  if (prior) return prior;

  const [owner, existingClient] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        currency: true,
        onboardingData: true,
        invoiceProfile: { select: { invoicePrefix: true } },
      },
    }),
    input.client.mode === "existing"
      ? prisma.client.findFirst({
          where: { id: input.client.id, userId },
          select: { id: true, name: true, email: true, company: true, address: true },
        })
      : Promise.resolve(null),
  ]);
  if (!owner) throw new EngagementInputError("Workspace owner not found.", "owner_not_found", 404);
  if (input.client.mode === "existing" && !existingClient) {
    throw new EngagementInputError("Client not found or unauthorized.", "client_not_found", 404);
  }
  if (input.entryPoint === "inquiry" && (!inquiryClientId || existingClient?.id !== inquiryClientId)) {
    throw new EngagementInputError("The converted Client could not be loaded.", "inquiry_client_locked", 409);
  }
  const currency = /^[A-Z]{3}$/.test(owner.currency) ? owner.currency : "USD";
  const onboardingData = owner.onboardingData && typeof owner.onboardingData === "object" && !Array.isArray(owner.onboardingData)
    ? owner.onboardingData as Record<string, unknown>
    : {};

  try {
    const result = await prisma.$transaction(async (tx) => {
      const client = existingClient || await tx.client.create({
        data: {
          id: ids.clientId,
          userId,
          name: input.client.mode === "new" ? input.client.name : "",
          email: input.client.mode === "new" ? input.client.email : null,
          avatarColor: ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"][Number.parseInt(ids.clientId[0], 16) % 4],
          tags: [],
          status: "active",
          dataOrigin: "user",
        },
        select: { id: true, name: true, email: true, company: true, address: true },
      });
      const project = await tx.project.create({
        data: {
          id: ids.projectId,
          userId,
          clientId: client.id,
          title: input.project.title,
          description: input.project.scope,
          status: "active",
          priority: "medium",
          dueDate: input.milestone?.dueDate || null,
          currency,
          tags: [],
          dataOrigin: "user",
          sourceInquiryId: input.sourceInquiryId || undefined,
        },
        select: { id: true, title: true, description: true },
      });
      const milestone = input.milestone
        ? await tx.milestone.create({
            data: {
              id: ids.milestoneId,
              projectId: project.id,
              title: input.milestone.title,
              dueDate: input.milestone.dueDate,
            },
            select: { id: true },
          })
        : null;

      let followUpTask: { id: string } | null = null;
      if (input.entryPoint === "inquiry" && input.sourceInquiryId) {
        const sourceTask = await tx.task.findFirst({
          where: { id: ids.taskId, userId, sourceInquiryId: input.sourceInquiryId },
          select: { id: true, projectId: true },
        });
        if (!sourceTask) {
          throw new EngagementInputError("Convert this enquiry before starting the engagement.", "inquiry_conversion_required", 409);
        }
        if (sourceTask.projectId && sourceTask.projectId !== project.id) {
          throw new EngagementInputError("This enquiry already has a different Project.", "idempotency_conflict", 409);
        }
        if (!sourceTask.projectId) {
          await tx.task.update({ where: { id: sourceTask.id }, data: { projectId: project.id } });
        }
        followUpTask = { id: sourceTask.id };
      }

      let contractId: string | undefined;
      if (input.scopeMode === "agreement") {
        const sections = createDefaultContractSections({ ownerName: owner.name || owner.email, clientName: client.name }).map((section) =>
          section.key === "scope" && input.project.scope
            ? {
                ...section,
                body: `${owner.name || owner.email} will provide the services and deliverables described in the linked project brief:\n\n${input.project.scope}\n\nWork outside this scope requires a written change agreed by both parties.`,
              }
            : section,
        );
        const agreement = await createAgreementDraft(tx, {
          contractId: ids.contractId,
          versionId: ids.versionId,
          owner: { id: owner.id, name: owner.name || owner.email, email: owner.email },
          client,
          project,
          title: `${project.title} — Services agreement`,
          currency,
          governingLaw: "India",
          jurisdiction: null,
          sections,
          paymentPlan: [],
        });
        contractId = agreement.contractId;
      }

      let invoiceId: string | undefined;
      if (input.invoice) {
        const now = new Date();
        const invoiceNumber = await nextInvoiceNumber(tx, userId, owner.invoiceProfile?.invoicePrefix || "INV", now);
        const invoice = await tx.invoice.create({
          data: {
            id: ids.invoiceId,
            userId,
            clientId: client.id,
            projectId: project.id,
            invoiceNumber,
            status: "draft",
            currency,
            subtotal: input.invoice.amount,
            total: input.invoice.amount,
            issueDate: now,
            dueDate: input.invoice.dueDate,
            dataOrigin: "user",
            items: {
              create: {
                description: input.milestone?.title || project.title,
                quantity: 1,
                unitPrice: input.invoice.amount,
                amount: input.invoice.amount,
              },
            },
          },
          select: { id: true },
        });
        invoiceId = invoice.id;
      }

      if (input.entryPoint === "onboarding") {
        await tx.user.update({
          where: { id: userId },
          data: {
            onboardingStatus: "complete",
            onboardingStep: 5,
            onboardingData: {
              ...onboardingData,
              goal: input.invoice ? "get_paid" : "organize",
              startingPath: "quickstart",
            } as Prisma.InputJsonObject,
          },
        });
      }

      const records: StartEngagementRecords = {
        clientId: client.id,
        projectId: project.id,
        ...(milestone ? { milestoneId: milestone.id } : {}),
        ...(followUpTask ? { taskId: followUpTask.id } : {}),
        ...(contractId ? { contractId } : {}),
        ...(invoiceId ? { invoiceId } : {}),
      };
      return { records, nextAction: nextAction(input, records), createdClient: input.client.mode === "new", replayed: false };
    });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const committed = await readCommittedEngagement(userId, input, ids);
      if (committed) return committed;
    }
    throw error;
  }
}

export async function convertPortfolioInquiry(
  userId: string,
  inquiryId: string,
  conversion: InquiryConversionInput,
): Promise<PortfolioInquiryConversionResult> {
  if (!engagementFlowAvailable()) throw new EngagementInputError("Start engagement is not enabled in this environment.", "feature_disabled", 404);
  const inquiry = await prisma.portfolioInquiry.findFirst({
    where: { id: inquiryId, userId },
    select: { id: true, name: true, status: true, clientId: true, convertedAt: true },
  });
  if (!inquiry) throw new EngagementInputError("Enquiry not found or unauthorized.", "inquiry_not_found", 404);
  if (inquiry.status === "spam") throw new EngagementInputError("Restore this enquiry before converting it.", "inquiry_spam", 409);

  const ids = recordIds(userId, inquiryFlowId(inquiry.id));
  const expectedClientId = conversion.client.mode === "existing" ? conversion.client.id : ids.clientId;
  if (inquiry.convertedAt || inquiry.clientId) {
    if (inquiry.clientId !== expectedClientId) {
      throw new EngagementInputError("This enquiry is already connected to another Client.", "inquiry_conversion_conflict", 409);
    }
    const existingTask = await prisma.task.findFirst({
      where: { id: ids.taskId, userId, sourceInquiryId: inquiry.id },
      select: { id: true },
    });
    if (!existingTask) {
      throw new EngagementInputError("This enquiry conversion is incomplete and cannot be replayed.", "inquiry_conversion_conflict", 409);
    }
    return {
      records: { clientId: expectedClientId, taskId: existingTask.id },
      nextAction: inquiryConversionNextAction(inquiry.id),
      createdClient: conversion.client.mode === "new" && expectedClientId === ids.clientId,
      replayed: true,
    };
  }

  const existingClient = conversion.client.mode === "existing"
    ? await prisma.client.findFirst({ where: { id: conversion.client.id, userId }, select: { id: true } })
    : null;
  if (conversion.client.mode === "existing" && !existingClient) {
    throw new EngagementInputError("Client not found or unauthorized.", "client_not_found", 404);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.portfolioInquiry.findFirst({
        where: { id: inquiry.id, userId },
        select: { id: true, name: true, status: true, clientId: true, convertedAt: true },
      });
      if (!current) throw new EngagementInputError("Enquiry not found or unauthorized.", "inquiry_not_found", 404);
      if (current.status === "spam") throw new EngagementInputError("Restore this enquiry before converting it.", "inquiry_spam", 409);
      if (current.convertedAt || current.clientId) {
        throw new EngagementInputError("This enquiry was converted elsewhere or is no longer available.", "inquiry_conversion_conflict", 409);
      }

      const client = existingClient || await tx.client.create({
        data: {
          id: ids.clientId,
          userId,
          name: conversion.client.mode === "new" ? conversion.client.name : "",
          email: conversion.client.mode === "new" ? conversion.client.email : null,
          avatarColor: ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"][Number.parseInt(ids.clientId[0], 16) % 4],
          tags: [],
          status: "active",
          dataOrigin: "user",
        },
        select: { id: true },
      });
      const task = await tx.task.create({
        data: {
          id: ids.taskId,
          userId,
          title: `Follow up with ${current.name}`.slice(0, 180),
          description: "Follow up on the converted portfolio enquiry.",
          status: "todo",
          priority: "medium",
          sourceInquiryId: current.id,
        },
        select: { id: true },
      });
      const converted = await tx.portfolioInquiry.updateMany({
        where: { id: current.id, userId, status: { not: "spam" }, convertedAt: null, clientId: null },
        data: { clientId: client.id, convertedAt: new Date() },
      });
      if (converted.count !== 1) {
        throw new EngagementInputError("This enquiry was converted elsewhere or is no longer available.", "inquiry_conversion_conflict", 409);
      }
      return {
        records: { clientId: client.id, taskId: task.id },
        nextAction: inquiryConversionNextAction(current.id),
        createdClient: conversion.client.mode === "new",
        replayed: false,
      };
    });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const committedInquiry = await prisma.portfolioInquiry.findFirst({
        where: { id: inquiry.id, userId },
        select: { clientId: true, convertedAt: true },
      });
      const committedTask = await prisma.task.findFirst({
        where: { id: ids.taskId, userId, sourceInquiryId: inquiry.id },
        select: { id: true },
      });
      if (committedInquiry?.convertedAt && committedInquiry.clientId && committedTask && committedInquiry.clientId === expectedClientId) {
        return {
          records: { clientId: committedInquiry.clientId, taskId: committedTask.id },
          nextAction: inquiryConversionNextAction(inquiry.id),
          createdClient: conversion.client.mode === "new" && committedInquiry.clientId === ids.clientId,
          replayed: true,
        };
      }
    }
    throw error;
  }
}
