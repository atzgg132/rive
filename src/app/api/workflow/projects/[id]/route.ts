import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getSessionUser(req);
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
          orderBy: { issueDate: "desc" }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      project
    });
  } catch (error: unknown) {
    console.error("Project fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
