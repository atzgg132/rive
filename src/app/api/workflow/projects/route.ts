import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

// GET /api/workflow/projects
export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const clientId = searchParams.get("clientId") || "";

    const where: any = {
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
            completed: true
          }
        }
      },
      orderBy: [
        { dueDate: "asc" },
        { createdAt: "desc" }
      ]
    });

    const formattedProjects = projects.map((p: any) => {
      const milestone_count = p.milestones.length;
      const completed_milestones = p.milestones.filter((m: any) => m.completed).length;

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
        tags: p.tags,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
        client_name: p.client?.name || null,
        client_company: p.client?.company || null,
        milestone_count,
        completed_milestones
      };
    });

    return NextResponse.json({
      success: true,
      projects: formattedProjects
    });
  } catch (error: any) {
    console.error("Projects fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// POST /api/workflow/projects
export async function POST(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
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
    } = await req.json();

    if (!title) {
      return NextResponse.json({ success: false, message: "Project title is required." }, { status: 400 });
    }

    // Insert project and milestones in a transaction
    const project = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          userId: session.userId,
          clientId: client_id || null,
          title,
          description: description || null,
          status: status || "active",
          priority: priority || "medium",
          startDate: start_date ? new Date(start_date) : null,
          dueDate: due_date ? new Date(due_date) : null,
          budget: budget ? Number(budget) : null,
          currency: currency || "USD",
          tags: tags || []
        }
      });

      if (milestones && Array.isArray(milestones) && milestones.length > 0) {
        const milestonesData = milestones
          .filter((m: any) => m.title)
          .map((m: any) => ({
            projectId: proj.id,
            title: m.title,
            dueDate: m.due_date ? new Date(m.due_date) : null,
            completed: m.completed || false
          }));

        if (milestonesData.length > 0) {
          await tx.milestone.createMany({
            data: milestonesData
          });
        }
      }

      return proj;
    });

    const formattedProject = {
      ...project,
      client_id: project.clientId,
      user_id: project.userId,
      start_date: project.startDate,
      due_date: project.dueDate,
      budget: project.budget ? project.budget.toString() : null,
      created_at: project.createdAt,
      updated_at: project.updatedAt
    };

    return NextResponse.json({
      success: true,
      message: "Project created successfully.",
      project: formattedProject
    }, { status: 201 });
  } catch (error: any) {
    console.error("Project create error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// PUT /api/workflow/projects
export async function PUT(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
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
      milestones 
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Project ID is required." }, { status: 400 });
    }

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ success: false, message: "Not found or unauthorized." }, { status: 404 });
    }

    const project = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.update({
        where: { id },
        data: {
          clientId: client_id !== undefined ? client_id : existing.clientId,
          title: title !== undefined ? title : existing.title,
          description: description !== undefined ? description : existing.description,
          status: status || existing.status,
          priority: priority || existing.priority,
          startDate: start_date ? new Date(start_date) : start_date === null ? null : existing.startDate,
          dueDate: due_date ? new Date(due_date) : due_date === null ? null : existing.dueDate,
          budget: budget !== undefined ? (budget ? Number(budget) : null) : existing.budget,
          currency: currency || existing.currency,
          tags: tags || existing.tags
        }
      });

      if (milestones && Array.isArray(milestones)) {
        await tx.milestone.deleteMany({ where: { projectId: id } });
        
        const milestonesData = milestones
          .filter((m: any) => m.title)
          .map((m: any) => ({
            projectId: proj.id,
            title: m.title,
            dueDate: m.due_date ? new Date(m.due_date) : null,
            completed: m.completed || false
          }));

        if (milestonesData.length > 0) {
          await tx.milestone.createMany({
            data: milestonesData
          });
        }
      }

      return proj;
    });

    return NextResponse.json({
      success: true,
      message: "Project updated successfully.",
      project
    }, { status: 200 });
  } catch (error: any) {
    console.error("Project update error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// DELETE /api/workflow/projects
export async function DELETE(req: NextRequest) {
  try {
    const session = getSessionUser(req);
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

    await prisma.project.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Project deleted successfully."
    }, { status: 200 });
  } catch (error: any) {
    console.error("Project delete error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
