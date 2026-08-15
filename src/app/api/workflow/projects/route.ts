import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { PROJECT_PRIORITY_SET, PROJECT_STATUS_SET } from "@/lib/domain-vocabulary";

// Shared with the migration engine so imported projects can never carry a
// status this endpoint would reject.
const PROJECT_STATUSES = PROJECT_STATUS_SET;
const PROJECT_PRIORITIES = PROJECT_PRIORITY_SET;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseOptionalDate(value: unknown): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMilestones(input: unknown): Array<{
  title: string;
  dueDate: Date | null;
  completed: boolean;
  completedAt: Date | null;
}> {
  if (!Array.isArray(input)) throw new Error("Milestones must be provided as a list.");
  if (input.length > 100) throw new Error("A project update can include at most 100 milestones.");

  return input.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Milestone ${index + 1} is invalid.`);
    const title = cleanText(item.title, 180);
    if (!title) throw new Error(`Milestone ${index + 1} needs a title.`);
    const dueDate = parseOptionalDate(item.due_date ?? item.dueDate);
    if (dueDate === "invalid") throw new Error(`Milestone ${index + 1} has an invalid due date.`);
    const completed = item.completed === true;
    return { title, dueDate, completed, completedAt: completed ? new Date() : null };
  });
}

// GET /api/workflow/projects
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const clientId = searchParams.get("clientId") || "";

    const where: Prisma.ProjectWhereInput = {
      userId: session.userId,
      status: { not: "archived" }
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } }
      ];
    }

    if (status !== "all") {
      where.status = status;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: {
          select: {
            name: true,
            company: true
          }
        },
        milestones: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            completed: true
          }
        },
        contracts: {
          where: { status: { not: "void" } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, status: true },
        }
      },
      orderBy: [
        { dueDate: "asc" },
        { createdAt: "desc" }
      ]
    });

    const formattedProjects = projects.map((p) => {
      const milestone_count = p.milestones.length;
      const completed_milestones = p.milestones.filter((m) => m.completed).length;

      return {
        id: p.id,
        client_id: p.clientId,
        user_id: p.userId,
        title: p.title,
        description: p.description,
        status: p.status,
        priority: p.priority,
        start_date: p.startDate,
        due_date: p.dueDate,
        budget: p.budget ? p.budget.toString() : null,
        currency: p.currency,
        contract_coverage: p.contracts.length > 0 ? "rive" : p.contractCoverage,
        external_contract_label: p.externalContractLabel,
        external_contract_url: p.externalContractUrl,
        contract_decision_at: p.contractDecisionAt,
        contract_count: p.contracts.length,
        latest_contract: p.contracts[0] || null,
        tags: p.tags,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
        client_name: p.client?.name || null,
        client_company: p.client?.company || null,
        milestone_count,
        completed_milestones,
        milestones: p.milestones.map((milestone) => ({ id: milestone.id, title: milestone.title, dueDate: milestone.dueDate, completed: milestone.completed }))
      };
    });

    return NextResponse.json({
      success: true,
      projects: formattedProjects
    });
  } catch (error: unknown) {
    console.error("Projects fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// POST /api/workflow/projects
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const parsedBody = await req.json().catch(() => null);
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
    }
    const { 
      title, 
      description, 
      client_id, 
      status, 
      priority, 
      start_date, 
      due_date, 
      budget, 
      currency, 
      tags, 
      milestones 
    } = parsedBody as Record<string, unknown>;

    const cleanTitle = cleanText(title, 180);
    if (!cleanTitle) {
      return NextResponse.json({ success: false, message: "Project title is required." }, { status: 400 });
    }
    const cleanClientId = cleanText(client_id, 80) || null;
    if (cleanClientId) {
      const client = await prisma.client.findFirst({ where: { id: cleanClientId, userId: session.userId }, select: { id: true } });
      if (!client) return NextResponse.json({ success: false, message: "Client not found or unauthorized." }, { status: 404 });
    }
    const owner = await prisma.user.findUnique({ where: { id: session.userId }, select: { currency: true } });
    if (!owner) return NextResponse.json({ success: false, message: "Workspace owner not found." }, { status: 404 });
    const cleanCurrency = cleanText(currency, 3).toUpperCase() || owner.currency;
    if (!/^[A-Z]{3}$/.test(cleanCurrency)) return NextResponse.json({ success: false, message: "Use a valid three-letter project currency." }, { status: 400 });
    const cleanStatus = cleanText(status, 24) || "active";
    const cleanPriority = cleanText(priority, 24) || "medium";
    if (!PROJECT_STATUSES.has(cleanStatus)) return NextResponse.json({ success: false, message: "Invalid project status." }, { status: 400 });
    if (!PROJECT_PRIORITIES.has(cleanPriority)) return NextResponse.json({ success: false, message: "Invalid project priority." }, { status: 400 });
    const parsedStartDate = parseOptionalDate(start_date);
    const parsedDueDate = parseOptionalDate(due_date);
    if (parsedStartDate === "invalid" || parsedDueDate === "invalid") return NextResponse.json({ success: false, message: "Use valid project dates." }, { status: 400 });
    if (parsedStartDate && parsedDueDate && parsedDueDate < parsedStartDate) return NextResponse.json({ success: false, message: "Project due date cannot be before its start date." }, { status: 400 });
    const parsedBudget = budget === null || budget === undefined || budget === "" ? null : Number(budget);
    if (parsedBudget !== null && (!Number.isFinite(parsedBudget) || parsedBudget < 0 || parsedBudget > 1_000_000_000)) return NextResponse.json({ success: false, message: "Project budget must be between 0 and 1,000,000,000." }, { status: 400 });
    if (tags !== undefined && !Array.isArray(tags)) return NextResponse.json({ success: false, message: "Project tags must be a list." }, { status: 400 });
    const cleanTags = Array.isArray(tags) ? tags.map((tag) => cleanText(tag, 60)).filter(Boolean).slice(0, 25) : [];
    let cleanMilestones: ReturnType<typeof normalizeMilestones> = [];
    try {
      cleanMilestones = milestones === undefined ? [] : normalizeMilestones(milestones);
    } catch (error) {
      return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Invalid milestones." }, { status: 400 });
    }

    // Insert project and milestones in a transaction
    const project = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          userId: session.userId,
          clientId: cleanClientId,
          title: cleanTitle,
          description: cleanText(description, 20_000) || null,
          status: cleanStatus,
          priority: cleanPriority,
          startDate: parsedStartDate,
          dueDate: parsedDueDate,
          budget: parsedBudget,
          currency: cleanCurrency,
          tags: cleanTags,
          dataOrigin: "user"
        }
      });

      if (cleanMilestones.length > 0) {
        const milestonesData = cleanMilestones.map((milestone) => ({
          projectId: proj.id,
          ...milestone,
        }));

        if (milestonesData.length > 0) {
          await tx.milestone.createMany({
            data: milestonesData
          });
        }
      }

      return proj;
    });
    await Promise.all([
      recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstProjectCreated, { projectId: project.id }),
      recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.projectCreated, module: "projects", entityType: "project", entityId: project.id, dataOrigin: "user" }),
    ]);

    const formattedProject = {
      ...project,
      client_id: project.clientId,
      user_id: project.userId,
      start_date: project.startDate,
      due_date: project.dueDate,
      budget: project.budget ? project.budget.toString() : null,
      contract_coverage: project.contractCoverage,
      external_contract_label: project.externalContractLabel,
      external_contract_url: project.externalContractUrl,
      contract_decision_at: project.contractDecisionAt,
      contract_count: 0,
      latest_contract: null,
      created_at: project.createdAt,
      updated_at: project.updatedAt
    };

    return NextResponse.json({
      success: true,
      message: "Project created successfully.",
      project: formattedProject
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("Project create error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// PUT /api/workflow/projects
export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!isRecord(body)) {
      return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
    }
    const { 
      id,
      title, 
      description, 
      client_id, 
      status, 
      priority, 
      start_date, 
      due_date, 
      budget, 
      currency, 
      tags, 
      milestones,
      new_milestones,
      replace_milestones,
    } = body;

    const cleanId = cleanText(id, 80);
    if (!cleanId) {
      return NextResponse.json({ success: false, message: "Project ID is required." }, { status: 400 });
    }

    const existing = await prisma.project.findUnique({ where: { id: cleanId } });
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ success: false, message: "Not found or unauthorized." }, { status: 404 });
    }

    const targetClientId = client_id !== undefined ? cleanText(client_id, 80) || null : existing.clientId;
    if (targetClientId) {
      const client = await prisma.client.findFirst({ where: { id: targetClientId, userId: session.userId }, select: { id: true } });
      if (!client) return NextResponse.json({ success: false, message: "Client not found or unauthorized." }, { status: 404 });
    }

    const replacingMilestones = Object.prototype.hasOwnProperty.call(body, "milestones") && replace_milestones === true;
    if (Object.prototype.hasOwnProperty.call(body, "milestones") && replace_milestones !== true) {
      return NextResponse.json({ success: false, message: "Milestone replacement requires explicit confirmation. Use new_milestones to add milestones without deleting existing records." }, { status: 400 });
    }

    let replacementMilestones: ReturnType<typeof normalizeMilestones> | null = null;
    let addedMilestones: ReturnType<typeof normalizeMilestones> = [];
    try {
      if (replacingMilestones) replacementMilestones = normalizeMilestones(milestones);
      if (Object.prototype.hasOwnProperty.call(body, "new_milestones")) addedMilestones = normalizeMilestones(new_milestones);
    } catch (error) {
      return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Invalid milestones." }, { status: 400 });
    }

    if (replacingMilestones) {
      const linkedMilestones = await prisma.contractPaymentPlanItem.findMany({
        where: { milestone: { projectId: cleanId } },
        select: { milestoneId: true, contract: { select: { title: true, status: true } } },
      });
      if (linkedMilestones.length > 0) {
        return NextResponse.json({ success: false, message: "This project has contract-linked milestones. Update those milestones individually so payment triggers and legal records are not broken." }, { status: 409 });
      }
    }

    if (client_id !== undefined && targetClientId !== existing.clientId) {
      const linkedContracts = await prisma.contract.count({ where: { projectId: cleanId } });
      if (linkedContracts > 0) {
        return NextResponse.json({ success: false, message: "This project is linked to contract records. Keep the client association stable; create a new project for a different client." }, { status: 409 });
      }
    }

    const nextTitle = title !== undefined ? cleanText(title, 180) : existing.title;
    if (!nextTitle) return NextResponse.json({ success: false, message: "Project title is required." }, { status: 400 });
    const nextStatus = status !== undefined ? cleanText(status, 24) : existing.status;
    const nextPriority = priority !== undefined ? cleanText(priority, 24) : existing.priority;
    if (!PROJECT_STATUSES.has(nextStatus)) return NextResponse.json({ success: false, message: "Invalid project status." }, { status: 400 });
    if (!PROJECT_PRIORITIES.has(nextPriority)) return NextResponse.json({ success: false, message: "Invalid project priority." }, { status: 400 });
    const nextCurrency = currency !== undefined ? cleanText(currency, 3).toUpperCase() : existing.currency;
    if (!/^[A-Z]{3}$/.test(nextCurrency)) return NextResponse.json({ success: false, message: "Use a valid three-letter project currency." }, { status: 400 });
    const nextStartDate = start_date !== undefined ? parseOptionalDate(start_date) : existing.startDate;
    const nextDueDate = due_date !== undefined ? parseOptionalDate(due_date) : existing.dueDate;
    if (nextStartDate === "invalid" || nextDueDate === "invalid") return NextResponse.json({ success: false, message: "Use valid project dates." }, { status: 400 });
    if (nextStartDate && nextDueDate && nextDueDate < nextStartDate) return NextResponse.json({ success: false, message: "Project due date cannot be before its start date." }, { status: 400 });
    const nextBudget = budget !== undefined ? (budget === null || budget === "" ? null : Number(budget)) : existing.budget;
    if (nextBudget !== null && (typeof nextBudget === "number" ? !Number.isFinite(nextBudget) || nextBudget < 0 || nextBudget > 1_000_000_000 : false)) {
      return NextResponse.json({ success: false, message: "Project budget must be between 0 and 1,000,000,000." }, { status: 400 });
    }
    if (tags !== undefined && !Array.isArray(tags)) return NextResponse.json({ success: false, message: "Project tags must be a list." }, { status: 400 });
    const nextTags = Array.isArray(tags) ? tags.map((tag) => cleanText(tag, 60)).filter(Boolean).slice(0, 25) : existing.tags;

    const project = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.update({
        where: { id: cleanId },
        data: {
          clientId: targetClientId,
          title: nextTitle,
          description: description !== undefined ? cleanText(description, 20_000) || null : existing.description,
          status: nextStatus,
          priority: nextPriority,
          startDate: nextStartDate,
          dueDate: nextDueDate,
          budget: nextBudget,
          currency: nextCurrency,
          tags: nextTags,
        }
      });

      if (replacementMilestones) {
        await tx.milestone.deleteMany({ where: { projectId: cleanId } });
        if (replacementMilestones.length > 0) await tx.milestone.createMany({ data: replacementMilestones.map((milestone) => ({ projectId: proj.id, ...milestone })) });
      }
      if (addedMilestones.length > 0) await tx.milestone.createMany({ data: addedMilestones.map((milestone) => ({ projectId: proj.id, ...milestone })) });

      return proj;
    });

    return NextResponse.json({
      success: true,
      message: "Project updated successfully.",
      project
    }, { status: 200 });
  } catch (error: unknown) {
    console.error("Project update error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// DELETE /api/workflow/projects
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Project ID is required." }, { status: 400 });
    }

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ success: false, message: "Not found or unauthorized." }, { status: 404 });
    }

    const linkedContracts = await prisma.contract.count({ where: { projectId: id } });
    if (linkedContracts > 0) {
      return NextResponse.json({ success: false, message: "This project has contract records. Archive it instead of deleting it so the contract-to-project history remains intact." }, { status: 409 });
    }

    await prisma.project.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Project deleted successfully."
    }, { status: 200 });
  } catch (error: unknown) {
    console.error("Project delete error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
