import "server-only";

import { Prisma } from "@prisma/client";
import { FIELD_LIMITS } from "@/lib/domain-vocabulary";
import { isDateOnly } from "@/utils/calendar";
import { prisma } from "@/utils/db";
import { hashRequestValue, sha256, stableStringify } from "@/utils/contracts";

const MAX_WORK_SETUP_MILESTONES = 100;
const MAX_WORK_SETUP_TASKS = 200;
const WORK_SETUP_KEY = /^[A-Za-z0-9_-]{1,80}$/;

const contractSourceSelect = {
  id: true,
  userId: true,
  clientId: true,
  title: true,
  status: true,
  currency: true,
  projectId: true,
  executedAt: true,
  project: {
    select: {
      id: true,
      userId: true,
      clientId: true,
      title: true,
      description: true,
      currency: true,
      startDate: true,
      dueDate: true,
      contractCoverage: true,
      externalContractLabel: true,
      externalContractUrl: true,
      contractDecisionAt: true,
      milestones: {
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, dueDate: true, completed: true, completedAt: true },
      },
    },
  },
  paymentPlanItems: {
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      label: true,
      amount: true,
      currency: true,
      triggerType: true,
      triggerDate: true,
      dueDays: true,
      invoiceDescription: true,
      milestoneId: true,
      milestone: { select: { id: true, title: true, dueDate: true, completed: true, completedAt: true } },
    },
  },
} as const;

const generationInclude = {
  acceptedVersion: { select: { id: true, version: true, content: true } },
  contract: { select: contractSourceSelect },
} as const;

export type OwnedProjectGeneration = Prisma.ProjectGenerationRecordGetPayload<{
  include: typeof generationInclude;
}>;

export type WorkSetupPlan = {
  schemaVersion: 1;
  project: {
    mode: "create" | "reuse";
    projectId: string | null;
    title: string;
    description: string | null;
    startDate: string | null;
    dueDate: string | null;
  };
  milestones: Array<{
    key: string;
    existingId: string | null;
    title: string;
    dueDate: string | null;
  }>;
  tasks: Array<{
    key: string;
    title: string;
    dueDate: string | null;
    milestoneKey: string | null;
    milestoneId: string | null;
  }>;
  billing: { activateAcceptedPlan: true };
};

export type WorkSetupResultIds = {
  projectId: string;
  milestoneIds: string[];
  taskIds: string[];
  billingOccurrenceIds: string[];
  invoiceIds: string[];
};

export class WorkSetupError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function dateOnlyValue(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function normalizeDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !isDateOnly(value)) {
    throw new WorkSetupError(`${label} must be a valid date.`, "invalid_date");
  }
  return value;
}

function toDate(value: string | null): Date | null {
  return value ? new Date(`${value}T12:00:00.000Z`) : null;
}

export function deterministicWorkSetupId(seed: string): string {
  const hex = sha256(seed).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function acceptedContent(generation: OwnedProjectGeneration): Record<string, unknown> {
  return isRecord(generation.acceptedVersion.content) ? generation.acceptedVersion.content : {};
}

function assertPlanKey(value: string, label: string): string {
  if (!WORK_SETUP_KEY.test(value)) throw new WorkSetupError(`${label} has an invalid identifier.`, "invalid_plan");
  return value;
}

export async function getOwnedProjectGeneration(userId: string, contractId: string): Promise<OwnedProjectGeneration | null> {
  return prisma.projectGenerationRecord.findFirst({
    where: { userId, contractId, contract: { userId, status: "executed" } },
    orderBy: { createdAt: "desc" },
    include: generationInclude,
  });
}

export function acceptedWorkSetupBillingPark(
  executedAt: Date,
  item: { triggerType: string; triggerDate: Date | null },
): { status: "awaiting_work_setup"; eligibleAt: Date | null } {
  const eligibleAt = item.triggerType === "on_signing"
    ? executedAt
    : ["fixed_date", "milestone_due"].includes(item.triggerType)
      ? item.triggerDate
      : null;
  return { status: "awaiting_work_setup", eligibleAt };
}

type WorkSetupPersistenceClient = Prisma.TransactionClient | typeof prisma;

export async function persistAcceptedAgreementWorkSetup(
  client: WorkSetupPersistenceClient,
  params: { userId: string; contractId: string; acceptedVersionId?: string | null },
): Promise<{ generationId: string; createdGeneration: boolean; parkedOccurrenceCount: number }> {
  const contract = await client.contract.findFirst({
    where: { id: params.contractId, userId: params.userId },
    select: {
      id: true,
      userId: true,
      status: true,
      executedAt: true,
      paymentPlanItems: { orderBy: { sequence: "asc" }, select: { id: true, triggerType: true, triggerDate: true } },
      versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
    },
  });
  if (!contract || contract.status !== "executed") {
    throw new WorkSetupError("Accepted Agreement work setup was not found.", "generation_not_found", 404);
  }

  const acceptedVersionId = params.acceptedVersionId || contract.versions[0]?.id;
  if (!acceptedVersionId) {
    throw new WorkSetupError("Accepted Agreement version not found.", "accepted_version_not_found", 409);
  }

  let createdGeneration = false;
  let generation = await client.projectGenerationRecord.findFirst({
    where: { userId: params.userId, contractId: contract.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, acceptedVersionId: true },
  });
  if (!generation) {
    try {
      generation = await client.projectGenerationRecord.create({
        data: {
          userId: params.userId,
          contractId: contract.id,
          acceptedVersionId,
          status: "pending",
        },
        select: { id: true, acceptedVersionId: true },
      });
      createdGeneration = true;
    } catch (error) {
      const uniqueConflict = Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
      if (!uniqueConflict) throw error;
      generation = await client.projectGenerationRecord.findFirst({
        where: { userId: params.userId, contractId: contract.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, acceptedVersionId: true },
      });
      if (!generation) throw error;
    }
  }
  if (!generation) {
    throw new WorkSetupError("Accepted Agreement work setup was not found.", "generation_not_found", 404);
  }

  const existingOccurrences = await client.contractBillingOccurrence.findMany({
    where: { contractId: contract.id },
    select: { paymentPlanItemId: true, status: true },
  });
  const existingItemIds = new Set(existingOccurrences.map((occurrence) => occurrence.paymentPlanItemId));
  const executedAt = contract.executedAt || new Date();
  const missingParks = contract.paymentPlanItems
    .filter((item) => !existingItemIds.has(item.id))
    .map((item) => ({
      contractId: contract.id,
      paymentPlanItemId: item.id,
      ...acceptedWorkSetupBillingPark(executedAt, item),
    }));
  let parkedOccurrenceCount = 0;
  if (missingParks.length > 0) {
    const created = await client.contractBillingOccurrence.createMany({
      data: missingParks,
      skipDuplicates: true,
    });
    parkedOccurrenceCount = created.count;
  }

  await client.contractPaymentPlanItem.updateMany({
    where: { contractId: contract.id, status: "planned" },
    data: { status: "active" },
  });

  return { generationId: generation.id, createdGeneration, parkedOccurrenceCount };
}

export async function ensureAcceptedAgreementWorkSetup(
  client: WorkSetupPersistenceClient,
  params: { userId: string; contractId: string; acceptedVersionId?: string | null },
): Promise<{ generationId: string; createdGeneration: boolean; parkedOccurrenceCount: number }> {
  if ("$transaction" in client && typeof client.$transaction === "function") {
    return client.$transaction((tx) => persistAcceptedAgreementWorkSetup(tx, params));
  }
  return persistAcceptedAgreementWorkSetup(client, params);
}

async function requireOwnedProjectGeneration(userId: string, contractId: string): Promise<OwnedProjectGeneration> {
  await ensureAcceptedAgreementWorkSetup(prisma, { userId, contractId });
  const generation = await getOwnedProjectGeneration(userId, contractId);
  if (!generation) throw new WorkSetupError("Accepted Agreement work setup was not found.", "generation_not_found", 404);
  return generation;
}

export function normalizeWorkSetupPlan(generation: OwnedProjectGeneration, rawPlan: unknown): WorkSetupPlan {
  const input = isRecord(rawPlan) ? rawPlan : {};
  const rawProject = isRecord(input.project) ? input.project : {};
  const linkedProject = generation.contract.project;
  const expectedMode = linkedProject ? "reuse" : "create";
  const requestedMode = clean(rawProject.mode, 12);
  if (requestedMode && requestedMode !== expectedMode) {
    throw new WorkSetupError(
      linkedProject ? "This Agreement must reuse its linked Project." : "This Agreement needs a new Project.",
      "project_mode_locked",
      409,
    );
  }

  const projectId = linkedProject?.id || null;
  const requestedProjectId = clean(rawProject.projectId ?? rawProject.project_id, 80) || null;
  if (linkedProject && requestedProjectId && requestedProjectId !== linkedProject.id) {
    throw new WorkSetupError("The linked Project cannot be changed during work setup.", "project_locked", 409);
  }

  const content = acceptedContent(generation);
  const acceptedTitle = clean(content.projectTitle, FIELD_LIMITS.projectTitle) || generation.contract.title.slice(0, FIELD_LIMITS.projectTitle);
  const acceptedDescription = clean(content.projectDescription, FIELD_LIMITS.projectDescription) || null;
  const title = linkedProject
    ? linkedProject.title
    : clean(hasOwn(rawProject, "title") ? rawProject.title : acceptedTitle, FIELD_LIMITS.projectTitle) || acceptedTitle;
  const description = linkedProject
    ? linkedProject.description || null
    : clean(hasOwn(rawProject, "description") ? rawProject.description : acceptedDescription, FIELD_LIMITS.projectDescription) || null;
  if (!title) throw new WorkSetupError("A Project title is required.", "missing_project_title");

  const startDate = normalizeDate(
    hasOwn(rawProject, "startDate") || hasOwn(rawProject, "start_date")
      ? rawProject.startDate ?? rawProject.start_date
      : dateOnlyValue(linkedProject?.startDate),
    "Project start date",
  );
  const dueDate = normalizeDate(
    hasOwn(rawProject, "dueDate") || hasOwn(rawProject, "due_date")
      ? rawProject.dueDate ?? rawProject.due_date
      : dateOnlyValue(linkedProject?.dueDate),
    "Project due date",
  );
  if (startDate && dueDate && dueDate < startDate) {
    throw new WorkSetupError("Project due date cannot be before its start date.", "invalid_project_dates");
  }

  const sourceMilestones = new Map((linkedProject?.milestones || []).map((milestone) => [milestone.id, milestone]));
  const rawMilestones = input.milestones === undefined ? [] : input.milestones;
  if (!Array.isArray(rawMilestones) || rawMilestones.length > MAX_WORK_SETUP_MILESTONES) {
    throw new WorkSetupError(`Add up to ${MAX_WORK_SETUP_MILESTONES} milestones.`, "invalid_plan");
  }
  const milestoneKeys = new Set<string>();
  const milestones = rawMilestones.map((value, index) => {
    if (!isRecord(value)) throw new WorkSetupError(`Milestone ${index + 1} is invalid.`, "invalid_plan");
    const existingId = clean(value.existingId ?? value.id, 80) || null;
    const existing = existingId ? sourceMilestones.get(existingId) : null;
    if (existingId && !existing) {
      throw new WorkSetupError(`Milestone ${index + 1} is not part of the linked Project.`, "milestone_not_found", 404);
    }
    const key = assertPlanKey(clean(value.key, 80) || (existingId ? `existing-${existingId}` : `milestone-${index + 1}`), `Milestone ${index + 1}`);
    if (milestoneKeys.has(key)) throw new WorkSetupError("Milestone identifiers must be unique.", "invalid_plan");
    milestoneKeys.add(key);
    const title = clean(hasOwn(value, "title") ? value.title : existing?.title, FIELD_LIMITS.projectTitle);
    if (!title) throw new WorkSetupError(`Milestone ${index + 1} needs a title.`, "invalid_plan");
    const dueDate = normalizeDate(
      hasOwn(value, "dueDate") || hasOwn(value, "due_date")
        ? value.dueDate ?? value.due_date
        : dateOnlyValue(existing?.dueDate),
      `Milestone ${index + 1} due date`,
    );
    return { key, existingId, title, dueDate };
  });

  const rawTasks = input.tasks === undefined ? [] : input.tasks;
  if (!Array.isArray(rawTasks) || rawTasks.length > MAX_WORK_SETUP_TASKS) {
    throw new WorkSetupError(`Add up to ${MAX_WORK_SETUP_TASKS} tasks.`, "invalid_plan");
  }
  const taskKeys = new Set<string>();
  const tasks = rawTasks.map((value, index) => {
    if (!isRecord(value)) throw new WorkSetupError(`Task ${index + 1} is invalid.`, "invalid_plan");
    const key = assertPlanKey(clean(value.key, 80) || `task-${index + 1}`, `Task ${index + 1}`);
    if (taskKeys.has(key)) throw new WorkSetupError("Task identifiers must be unique.", "invalid_plan");
    taskKeys.add(key);
    const milestoneKey = clean(value.milestoneKey, 80) || null;
    const milestoneId = clean(value.milestoneId, 80) || null;
    if (milestoneKey && milestoneId) throw new WorkSetupError(`Task ${index + 1} can use one milestone reference.`, "invalid_plan");
    if (milestoneKey && !milestoneKeys.has(milestoneKey)) {
      throw new WorkSetupError(`Task ${index + 1} references an unknown milestone.`, "invalid_plan");
    }
    if (milestoneId && !sourceMilestones.has(milestoneId) && !milestones.some((milestone) => milestone.existingId === milestoneId)) {
      throw new WorkSetupError(`Task ${index + 1} references an unknown milestone.`, "milestone_not_found", 404);
    }
    const title = clean(value.title, FIELD_LIMITS.projectTitle);
    if (!title) throw new WorkSetupError(`Task ${index + 1} needs a title.`, "invalid_plan");
    const dueDate = normalizeDate(
      hasOwn(value, "dueDate") || hasOwn(value, "due_date") ? value.dueDate ?? value.due_date : null,
      `Task ${index + 1} due date`,
    );
    if (!dueDate) throw new WorkSetupError(`Task ${index + 1} needs a due date.`, "task_due_date_required");
    return { key, title, dueDate, milestoneKey, milestoneId };
  });

  if (isRecord(input.billing) && input.billing.activateAcceptedPlan === false) {
    throw new WorkSetupError("The accepted payment plan must remain active.", "billing_locked", 409);
  }

  return {
    schemaVersion: 1,
    project: { mode: expectedMode, projectId, title, description, startDate, dueDate },
    milestones,
    tasks,
    billing: { activateAcceptedPlan: true },
  };
}

export function previewWorkSetup(generation: OwnedProjectGeneration, rawPlan: unknown): { plan: WorkSetupPlan; hash: string } {
  const plan = normalizeWorkSetupPlan(generation, rawPlan);
  return { plan, hash: sha256(stableStringify(plan)) };
}

export function serializeProjectGeneration(generation: OwnedProjectGeneration) {
  return {
    id: generation.id,
    status: generation.status,
    accepted_version_id: generation.acceptedVersionId,
    preview_plan: generation.previewPlan,
    preview_hash: generation.previewHash,
    result_ids: generation.resultIds,
    error: generation.error,
    previewed_at: generation.previewedAt,
    started_at: generation.startedAt,
    completed_at: generation.completedAt,
    failed_at: generation.failedAt,
    created_at: generation.createdAt,
    updated_at: generation.updatedAt,
  };
}

function resultIdsFromJson(value: Prisma.JsonValue | null): WorkSetupResultIds | null {
  if (!isRecord(value) || typeof value.projectId !== "string") return null;
  const strings = (candidate: unknown): string[] => Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === "string") : [];
  return {
    projectId: value.projectId,
    milestoneIds: strings(value.milestoneIds),
    taskIds: strings(value.taskIds),
    billingOccurrenceIds: strings(value.billingOccurrenceIds),
    invoiceIds: strings(value.invoiceIds),
  };
}

export async function saveWorkSetupPreview(userId: string, contractId: string, rawPlan: unknown) {
  const generation = await requireOwnedProjectGeneration(userId, contractId);
  if (generation.status === "succeeded") {
    const saved = resultIdsFromJson(generation.resultIds);
    return { generation, plan: generation.previewPlan, hash: generation.previewHash, resultIds: saved, replayed: true };
  }
  if (generation.status === "running") throw new WorkSetupError("Work setup is already being confirmed.", "generation_in_progress", 409);
  const preview = previewWorkSetup(generation, rawPlan);
  const updated = await prisma.projectGenerationRecord.updateMany({
    where: { id: generation.id, userId, status: { in: ["pending", "previewed", "failed"] } },
    data: {
      status: "previewed",
      previewPlan: preview.plan as unknown as Prisma.InputJsonValue,
      previewHash: preview.hash,
      idempotencyKeyHash: null,
      error: null,
      failedAt: null,
      previewedAt: new Date(),
    },
  });
  if (updated.count !== 1) throw new WorkSetupError("Work setup changed while it was being previewed. Reload and try again.", "generation_conflict", 409);
  const latest = await getOwnedProjectGeneration(userId, contractId);
  if (!latest) throw new WorkSetupError("Accepted Agreement work setup disappeared after preview.", "generation_not_found", 404);
  return { generation: latest, plan: preview.plan, hash: preview.hash, resultIds: null, replayed: false };
}

type BillingItem = {
  triggerType: string;
  triggerDate: Date | null;
  milestone: { dueDate: Date | null; completed: boolean; completedAt: Date | null } | null;
};

function billingEligible(item: BillingItem, now: Date): boolean {
  if (item.triggerType === "on_signing") return true;
  if (item.triggerType === "fixed_date") return Boolean(item.triggerDate && item.triggerDate <= now);
  if (item.triggerType === "milestone_completed") return Boolean(item.milestone?.completed);
  if (item.triggerType === "milestone_due") return Boolean((item.triggerDate || item.milestone?.dueDate) && (item.triggerDate || item.milestone?.dueDate)! <= now);
  return false;
}

function billingEligibilityDate(item: BillingItem, now: Date): Date {
  if (item.triggerType === "fixed_date" && item.triggerDate) return item.triggerDate;
  if (item.triggerType === "milestone_due" && (item.triggerDate || item.milestone?.dueDate)) return (item.triggerDate || item.milestone?.dueDate)!;
  if (item.triggerType === "milestone_completed" && item.milestone?.completedAt) return item.milestone.completedAt;
  return now;
}

function parseSavedPlan(generation: OwnedProjectGeneration): WorkSetupPlan {
  if (!generation.previewPlan || !generation.previewHash) {
    throw new WorkSetupError("Preview the work setup before confirming it.", "preview_required", 409);
  }
  const plan = normalizeWorkSetupPlan(generation, generation.previewPlan);
  if (sha256(stableStringify(plan)) !== generation.previewHash) {
    throw new WorkSetupError("The saved work setup preview is invalid. Preview it again before confirming.", "preview_corrupt", 409);
  }
  return plan;
}

export async function confirmWorkSetup(
  userId: string,
  contractId: string,
  previewHash: string,
  idempotencyKey: string,
): Promise<{ generation: OwnedProjectGeneration; resultIds: WorkSetupResultIds; replayed: boolean }> {
  const generation = await requireOwnedProjectGeneration(userId, contractId);
  if (!previewHash || generation.previewHash !== previewHash) {
    throw new WorkSetupError("This work setup preview is stale. Preview it again before confirming.", "stale_preview", 409);
  }
  const normalizedIdempotencyKey = idempotencyKey.trim();
  if (!/^[A-Za-z0-9._:-]{16,160}$/.test(normalizedIdempotencyKey)) {
    throw new WorkSetupError("A valid Idempotency-Key is required.", "invalid_idempotency_key", 400);
  }
  const idempotencyKeyHash = hashRequestValue(normalizedIdempotencyKey);
  const savedResult = resultIdsFromJson(generation.resultIds);
  if (generation.status === "succeeded" && savedResult) {
    if (generation.idempotencyKeyHash && generation.idempotencyKeyHash !== idempotencyKeyHash) {
      throw new WorkSetupError("This work setup was already confirmed with a different Idempotency-Key.", "idempotency_conflict", 409);
    }
    return { generation, resultIds: savedResult, replayed: true };
  }
  if (generation.idempotencyKeyHash && generation.idempotencyKeyHash !== idempotencyKeyHash) {
    throw new WorkSetupError("This work setup already has a different confirmation in progress or recorded.", "idempotency_conflict", 409);
  }
  const plan = parseSavedPlan(generation);
  const now = new Date();

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      const claimed = await tx.projectGenerationRecord.updateMany({
        where: {
          id: generation.id,
          userId,
          status: { in: ["pending", "previewed", "failed"] },
          previewHash,
          OR: [{ idempotencyKeyHash: null }, { idempotencyKeyHash }],
        },
        data: { status: "running", startedAt: now, idempotencyKeyHash, error: null, failedAt: null },
      });
      if (claimed.count !== 1) {
        const current = await tx.projectGenerationRecord.findUnique({
          where: { id: generation.id },
          select: { status: true, resultIds: true, idempotencyKeyHash: true },
        });
        const currentResult = resultIdsFromJson(current?.resultIds || null);
        if (current?.idempotencyKeyHash && current.idempotencyKeyHash !== idempotencyKeyHash) {
          throw new WorkSetupError("This work setup already has a different confirmation in progress or recorded.", "idempotency_conflict", 409);
        }
        if (current?.status === "succeeded" && currentResult) return { replayed: true, resultIds: currentResult };
        if (current?.status === "running") throw new WorkSetupError("Work setup is already being confirmed.", "generation_in_progress", 409);
        throw new WorkSetupError("Work setup changed while it was being confirmed. Reload and preview again.", "generation_conflict", 409);
      }

      const contract = await tx.contract.findFirst({ where: { id: contractId, userId, status: "executed" }, select: contractSourceSelect });
      if (!contract) throw new WorkSetupError("Accepted Agreement not found.", "contract_not_found", 404);
      const linkedProject = contract.project;
      let projectId: string;

      if (plan.project.mode === "reuse") {
        if (!linkedProject || contract.projectId !== plan.project.projectId) {
          throw new WorkSetupError("The linked Project changed. Preview the work setup again.", "project_changed", 409);
        }
        if (linkedProject.userId !== userId || linkedProject.clientId !== contract.clientId) {
          throw new WorkSetupError("The linked Project is not owned by this Agreement workspace.", "project_not_owned", 404);
        }
        projectId = linkedProject.id;
        await tx.project.update({
          where: { id: projectId },
          data: {
            startDate: toDate(plan.project.startDate),
            dueDate: toDate(plan.project.dueDate),
            contractCoverage: "rive",
            externalContractLabel: null,
            externalContractUrl: null,
            contractDecisionAt: now,
          },
        });
      } else {
        if (contract.projectId) throw new WorkSetupError("This Agreement now has a linked Project. Preview again to reuse it.", "project_changed", 409);
        projectId = deterministicWorkSetupId(`${generation.id}:project`);
        await tx.project.create({
          data: {
            id: projectId,
            userId,
            clientId: contract.clientId,
            title: plan.project.title,
            description: plan.project.description,
            status: "active",
            priority: "medium",
            startDate: toDate(plan.project.startDate),
            dueDate: toDate(plan.project.dueDate),
            currency: contract.currency,
            contractCoverage: "rive",
            externalContractLabel: null,
            externalContractUrl: null,
            contractDecisionAt: now,
            dataOrigin: "user",
            tags: [],
          },
        });
        await tx.contract.update({ where: { id: contract.id }, data: { projectId } });
      }

      const milestoneIds: string[] = [];
      const milestoneIdsByKey = new Map<string, string>();
      for (const milestone of plan.milestones) {
        if (milestone.existingId) {
          const existing = await tx.milestone.findFirst({ where: { id: milestone.existingId, projectId }, select: { id: true } });
          if (!existing) throw new WorkSetupError(`Milestone “${milestone.title}” is no longer part of the Project.`, "milestone_changed", 409);
          milestoneIds.push(existing.id);
          milestoneIdsByKey.set(milestone.key, existing.id);
          continue;
        }
        const id = deterministicWorkSetupId(`${generation.id}:milestone:${milestone.key}`);
        const existing = await tx.milestone.findUnique({ where: { id }, select: { id: true, projectId: true } });
        if (existing && existing.projectId !== projectId) throw new WorkSetupError("A generated milestone identifier conflicts with another Project.", "generation_conflict", 409);
        if (!existing) {
          await tx.milestone.create({
            data: { id, projectId, title: milestone.title, dueDate: toDate(milestone.dueDate), completed: false },
          });
        }
        milestoneIds.push(id);
        milestoneIdsByKey.set(milestone.key, id);
      }

      const taskIds: string[] = [];
      for (const task of plan.tasks) {
        const milestoneId = task.milestoneId || (task.milestoneKey ? milestoneIdsByKey.get(task.milestoneKey) || null : null);
        const id = deterministicWorkSetupId(`${generation.id}:task:${task.key}`);
        const existing = await tx.task.findUnique({ where: { id }, select: { id: true, userId: true, projectId: true } });
        if (existing && (existing.userId !== userId || existing.projectId !== projectId)) {
          throw new WorkSetupError("A generated task identifier conflicts with another Project.", "generation_conflict", 409);
        }
        if (!existing) {
          await tx.task.create({
            data: {
              id,
              userId,
              projectId,
              milestoneId,
              title: task.title,
              status: "todo",
              priority: "medium",
              dueDate: toDate(task.dueDate),
              billable: false,
            },
          });
        }
        taskIds.push(id);
      }

      const billingOccurrenceIds: string[] = [];
      const occurrences = await tx.contractBillingOccurrence.findMany({
        where: { contractId: contract.id, invoiceId: null },
        select: {
          id: true,
          status: true,
          eligibleAt: true,
          paymentPlanItem: { select: { triggerType: true, triggerDate: true, milestone: { select: { dueDate: true, completed: true, completedAt: true } } } },
        },
      });
      for (const occurrence of occurrences) {
        if (occurrence.status !== "awaiting_work_setup") continue;
        const item = occurrence.paymentPlanItem;
        const eligible = billingEligible(item, now);
        const eligibleAt = occurrence.eligibleAt || (eligible ? billingEligibilityDate(item, now) : null);
        await tx.contractBillingOccurrence.update({
          where: { id: occurrence.id },
          data: { status: eligible ? "eligible" : "pending", eligibleAt, lastError: null },
        });
        billingOccurrenceIds.push(occurrence.id);
      }

      const resultIds: WorkSetupResultIds = {
        projectId,
        milestoneIds,
        taskIds,
        billingOccurrenceIds,
        invoiceIds: [],
      };
      await tx.projectGenerationRecord.update({
        where: { id: generation.id },
        data: {
          projectId,
          status: "succeeded",
          resultIds: resultIds as unknown as Prisma.InputJsonValue,
          error: null,
          completedAt: now,
        },
      });
      await tx.contractEvent.create({
        data: {
          contractId: contract.id,
          versionId: generation.acceptedVersionId,
          actorUserId: userId,
          eventType: "contract_project_generated",
          metadata: {
            generationRecordId: generation.id,
            projectId,
            milestoneCount: milestoneIds.length,
            taskCount: taskIds.length,
            billingOccurrenceCount: billingOccurrenceIds.length,
          },
        },
      });
      return { replayed: false, resultIds };
    });

    const latest = await getOwnedProjectGeneration(userId, contractId);
    if (!latest) throw new WorkSetupError("Work setup disappeared after confirmation.", "generation_not_found", 404);
    const resultIds = transactionResult.resultIds || resultIdsFromJson(latest.resultIds);
    if (!resultIds) throw new WorkSetupError("Work setup completed without a result record.", "generation_result_missing", 500);
    return { generation: latest, resultIds, replayed: transactionResult.replayed };
  } catch (error) {
    if (error instanceof WorkSetupError && error.code === "generation_in_progress") throw error;
    const message = error instanceof Error ? error.message.slice(0, 500) : "Work setup failed.";
    await prisma.projectGenerationRecord.updateMany({
      where: {
        id: generation.id,
        userId,
        status: { in: ["pending", "previewed", "failed"] },
        OR: [{ idempotencyKeyHash: null }, { idempotencyKeyHash }],
      },
      data: { status: "failed", error: message, failedAt: new Date(), startedAt: generation.startedAt || new Date(), idempotencyKeyHash },
    }).catch(() => undefined);
    throw error;
  }
}
