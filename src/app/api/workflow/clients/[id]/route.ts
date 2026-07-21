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

    const client = await prisma.client.findFirst({
      where: { 
        id,
        userId: session.userId 
      },
      include: {
        projects: {
          orderBy: { createdAt: "desc" }
        },
        invoices: {
          orderBy: { issueDate: "desc" },
          include: { items: true }
        }
      }
    });

    if (!client) {
      return NextResponse.json({ success: false, message: "Client not found." }, { status: 404 });
    }

    // Calculate LTV
    const ltv = client.invoices
      .filter((inv: any) => inv.status === "paid")
      .reduce((sum: number, inv: any) => sum + Number(inv.total), 0);

    return NextResponse.json({
      success: true,
      client: {
        ...client,
        ltv
      }
    });
  } catch (error: any) {
    console.error("Client fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
