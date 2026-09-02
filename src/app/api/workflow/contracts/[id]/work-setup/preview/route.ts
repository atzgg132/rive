import { NextRequest, NextResponse } from "next/server";
import { assertContractsEnabled } from "@/utils/contracts";
import { getSessionUser } from "@/utils/userAuth";
import { rateLimit } from "@/utils/rateLimit";
import {
  WorkSetupError,
  saveWorkSetupPreview,
  serializeProjectGeneration,
} from "@/utils/projectGeneration";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    if (!rateLimit(`work-setup-preview:${session.userId}:${id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json({ success: false, message: "Too many work setup previews. Try again later.", code: "rate_limited" }, { status: 429 });
    }
    const body = await req.json().catch(() => null);
    const rawPlan = isRecord(body) && Object.prototype.hasOwnProperty.call(body, "plan") ? body.plan : body;
    const result = await saveWorkSetupPreview(session.userId, id, rawPlan);
    return NextResponse.json({
      success: true,
      generation: serializeProjectGeneration(result.generation),
      plan: result.plan,
      previewHash: result.hash,
      resultIds: result.resultIds,
      replayed: result.replayed,
    });
  } catch (error) {
    if (error instanceof WorkSetupError) {
      return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: error.status });
    }
    console.error("Work setup preview error:", error);
    return NextResponse.json({ success: false, message: "Unable to preview work setup." }, { status: 500 });
  }
}
