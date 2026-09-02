import { NextRequest, NextResponse } from "next/server";
import { assertContractsEnabled, createNotification } from "@/utils/contracts";
import { processContractBilling } from "@/utils/contractBilling";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import {
  WorkSetupError,
  confirmWorkSetup,
  serializeProjectGeneration,
} from "@/utils/projectGeneration";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    if (!rateLimit(`work-setup-confirm:${session.userId}:${id}:${getRequestIp(req)}`, 12, 60 * 60 * 1000)) {
      return NextResponse.json({ success: false, message: "Too many work setup confirmations. Try again later.", code: "rate_limited" }, { status: 429 });
    }
    const idempotencyKey = req.headers.get("Idempotency-Key") || "";
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const previewHash = typeof body?.previewHash === "string"
      ? body.previewHash.trim()
      : typeof body?.preview_hash === "string"
        ? body.preview_hash.trim()
        : "";
    const result = await confirmWorkSetup(session.userId, id, previewHash, idempotencyKey);
    const billing = await processContractBilling({ userId: session.userId, contractId: id, limit: 100 }).catch((error) => {
      console.error("Post-work-setup billing check failed:", error);
      return { checked: 0, eligible: 0, drafted: 0, failed: 1, failures: ["post_commit_billing"] };
    });
    if (!result.replayed) {
      await Promise.all([
        recordProductEvent({
          userId: session.userId,
          eventName: PRODUCT_EVENTS.agreementWorkCreated,
          module: "agreements",
          entityType: "project",
          entityId: result.resultIds.projectId,
          dataOrigin: "user",
          source: "agreement_work_setup",
          dedupeKey: `agreement_work_created:${id}:${result.generation.acceptedVersionId}`,
          properties: {
            generationRecordId: result.generation.id,
            milestoneCount: result.resultIds.milestoneIds.length,
            taskCount: result.resultIds.taskIds.length,
          },
        }),
        createNotification({
          userId: session.userId,
          type: "contract_work_created",
          title: "Work setup created",
          message: "The Project, plan, and accepted billing triggers are ready to review.",
          href: `/workflow/projects/${encodeURIComponent(result.resultIds.projectId)}`,
        }).catch(() => undefined),
      ]);
    }
    return NextResponse.json({
      success: true,
      generation: serializeProjectGeneration(result.generation),
      resultIds: result.resultIds,
      replayed: result.replayed,
      billing,
      nextAction: { href: `/workflow/projects/${encodeURIComponent(result.resultIds.projectId)}`, label: "Review the Project" },
    });
  } catch (error) {
    if (error instanceof WorkSetupError) {
      return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: error.status });
    }
    console.error("Work setup confirmation error:", error);
    return NextResponse.json({ success: false, message: "Unable to confirm work setup." }, { status: 500 });
  }
}
