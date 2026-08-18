import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: { 
        id,
        userId: session.userId 
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            avatarColor: true,
            email: true,
            phone: true
          }
        },
        invoices: {
          orderBy: [{ issueDate: "desc" }, { id: "desc" }],
          take: 10,
        },
        milestones: {
          orderBy: [{ dueDate: "asc" }, { id: "asc" }],
          take: 50,
        },
        contracts: {
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 10,
          select: {
            id: true,
            title: true,
            status: true,
            currency: true,
            executedAt: true,
            updatedAt: true,
          },
        },
      }
    });

    if (!project) {
      return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
    }

    const [invoiceCount, milestoneCount, contractCount] = await Promise.all([
      prisma.invoice.count({ where: { userId: session.userId, projectId: id } }),
      prisma.milestone.count({ where: { projectId: id } }),
      prisma.contract.count({ where: { userId: session.userId, projectId: id, status: { not: "void" } } }),
    ]);

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        related_counts: { invoices: invoiceCount, milestones: milestoneCount, contracts: contractCount },
      },
    });
  } catch (error: unknown) {
    console.error("Project fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
