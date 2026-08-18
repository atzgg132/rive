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

    const client = await prisma.client.findFirst({
      where: { 
        id,
        userId: session.userId 
      },
      include: {
        projects: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 10,
        },
        invoices: {
          orderBy: [{ issueDate: "desc" }, { id: "desc" }],
          take: 10,
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
            projectId: true,
          },
        },
      }
    });

    if (!client) {
      return NextResponse.json({ success: false, message: "Client not found." }, { status: 404 });
    }

    const [projectCount, invoiceCount, contractCount, paidRevenue] = await Promise.all([
      prisma.project.count({ where: { userId: session.userId, clientId: id } }),
      prisma.invoice.count({ where: { userId: session.userId, clientId: id } }),
      prisma.contract.count({ where: { userId: session.userId, clientId: id } }),
      prisma.invoice.groupBy({
        by: ["currency"],
        where: { userId: session.userId, clientId: id, status: "paid" },
        _sum: { total: true },
      }),
    ]);
    const paidRevenueByCurrency = Object.fromEntries(paidRevenue.map((row) => [row.currency, Number(row._sum.total || 0)]));

    return NextResponse.json({
      success: true,
      client: {
        ...client,
        ltv: Object.values(paidRevenueByCurrency).reduce((sum, amount) => sum + amount, 0),
        paid_revenue_by_currency: paidRevenueByCurrency,
        related_counts: { projects: projectCount, invoices: invoiceCount, contracts: contractCount },
      }
    });
  } catch (error: unknown) {
    console.error("Client fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
