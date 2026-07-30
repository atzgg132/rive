import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const jobs = await prisma.importJob.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      source: true,
      sourceLabel: true,
      status: true,
      phase: true,
      totalRows: true,
      processedRows: true,
      createdRecords: true,
      updatedRecords: true,
      skippedRecords: true,
      unresolvedCount: true,
      summary: true,
      error: true,
      createdAt: true,
      completedAt: true,
      rolledBackAt: true,
      files: {
        select: {
          id: true,
          name: true,
          entity: true,
          rowCount: true,
          headers: true,
          mapping: true,
        },
      },
      issues: {
        where: { resolvedAt: null },
        orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
        take: 100,
        select: {
          id: true,
          sourceRow: true,
          entity: true,
          severity: true,
          code: true,
          message: true,
          field: true,
          sourceValue: true,
          candidates: true,
        },
      },
    },
  });

  return NextResponse.json({ success: true, jobs });
}
