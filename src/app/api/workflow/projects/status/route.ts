import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { PROJECT_STATUS_SET } from "@/lib/domain-vocabulary";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { projectProofOffer } from "@/utils/portfolio";

class ProjectConflictError extends Error {
  constructor() {
    super("PROJECT_CONFLICT");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, message: "Project ID and status are required." }, { status: 400 });
    }
    // The general project endpoints validate this field on both create and
    // update; this one wrote the raw body value straight through, so the
    // dedicated status route was the only way to put a project into a state no
    // filter matches — which makes it disappear from every board and list.
    if (typeof status !== "string" || !PROJECT_STATUS_SET.has(status)) {
      return NextResponse.json({ success: false, message: "Invalid project status." }, { status: 400 });
    }

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ success: false, message: "Not found or unauthorized." }, { status: 404 });
    }

    const completionTransition = existing.status !== "completed" && status === "completed";
    const completedAt = completionTransition
      ? existing.completedAt || new Date()
      : status === "completed"
        ? existing.completedAt
        : null;
    const project = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.updateMany({
        where: { id, userId: session.userId, status: existing.status, updatedAt: existing.updatedAt },
        data: { status, completedAt },
      });
      if (updated.count !== 1) throw new ProjectConflictError();
      const saved = await tx.project.findUnique({ where: { id } });
      if (!saved) throw new ProjectConflictError();
      return saved;
    });

    if (completionTransition) {
      await recordProductEvent({
        userId: session.userId,
        eventName: PRODUCT_EVENTS.projectCompleted,
        module: "projects",
        entityType: "project",
        entityId: project.id,
        dataOrigin: "user",
        dedupeKey: `project_completed:${project.id}:${project.completedAt?.toISOString() || "unknown"}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Project status updated successfully.",
      project,
      ...(completionTransition ? { proof_offer: projectProofOffer(project.id) } : {}),
    }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof ProjectConflictError) {
      return NextResponse.json({ success: false, message: "This project changed while its status was being updated. Reload and try again." }, { status: 409 });
    }
    console.error("Project status update error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
