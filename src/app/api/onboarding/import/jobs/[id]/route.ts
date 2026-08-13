import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { executeRollback } from "@/utils/migration/rollback";

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

// Delegates to the migration engine's rollback logic (src/utils/migration/rollback.ts)
// rather than deleting directly, so both the legacy onboarding import screen and the
// v2 Migration Engine share the same eligibility check: a record is only removed if
// it is demonstrably untouched since import. Records the user has since edited, or
// that something else now depends on, are reported as conflicts and kept. This is
// the only rollback path for ImportJob regardless of which engine created it.
export async function DELETE(req: NextRequest, context: ImportJobRouteContext) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  if (!rateLimit(`import-rollback:${session.userId}:${getRequestIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many rollback attempts. Try again later." }, { status: 429 });
  }
  const { id } = await context.params;
  const job = await prisma.importJob.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
  if (!job) return NextResponse.json({ success: false, message: "Import not found." }, { status: 404 });

  const outcome = await executeRollback(session.userId, id);
  if (!outcome.ok) {
    return NextResponse.json({ success: false, message: outcome.message || "This import cannot be rolled back." }, { status: 409 });
  }
  return NextResponse.json({ success: true, deleted: outcome.deleted, conflicts: outcome.conflicts });
}
