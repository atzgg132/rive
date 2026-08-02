import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { processContractBilling } from "@/utils/contractBilling";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const contract = await prisma.contract.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
    if (!contract) return NextResponse.json({ success: false, message: "Contract not found." }, { status: 404 });
    const result = await processContractBilling({ userId: session.userId, contractId: id, limit: 100 });
    return NextResponse.json({ success: result.failed === 0, ...result });
  } catch (error) {
    console.error("Contract billing run error:", error);
    return NextResponse.json({ success: false, message: "Unable to run contract billing." }, { status: 500 });
  }
}

