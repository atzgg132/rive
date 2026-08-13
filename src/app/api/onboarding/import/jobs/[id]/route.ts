import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

type ImportJobRouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: ImportJobRouteContext) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  const { id } = await context.params;
  const job = await prisma.importJob.findFirst({
    where: { id, userId: session.userId },
    include: {
      files: true,
      records: { orderBy: { createdAt: "asc" } },
      issues: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!job) return NextResponse.json({ success: false, message: "Import not found." }, { status: 404 });
  return NextResponse.json({ success: true, job });
}

/** Historical deletion endpoint. Imported records are never removed. */
export async function DELETE() {
  return NextResponse.json(
    { success: false, message: "Import rollback is disabled. Imported records are never removed." },
    { status: 410 },
  );
}
