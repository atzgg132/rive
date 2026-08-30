import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { getSessionUser } from "@/utils/userAuth";

const ALLOWED_EVENTS: Set<string> = new Set([
  PRODUCT_EVENTS.engagementFlowStarted,
  PRODUCT_EVENTS.engagementStepViewed,
  PRODUCT_EVENTS.engagementStepCompleted,
]);
const ALLOWED_STEPS = new Set(["client", "work", "setup"]);

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ success: false }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const eventName = clean(body?.eventName, 80);
  const flowId = clean(body?.flowId, 80);
  const entryPoint = body?.entryPoint === "onboarding" ? "onboarding" : body?.entryPoint === "workspace" ? "workspace" : "";
  const step = clean(body?.step, 20);
  if (!ALLOWED_EVENTS.has(eventName) || !/^[a-zA-Z0-9_-]{16,80}$/.test(flowId) || !entryPoint) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  if (step && !ALLOWED_STEPS.has(step)) return NextResponse.json({ success: false }, { status: 400 });

  await recordProductEvent({
    userId: session.userId,
    sessionId: clean(body?.sessionId, 100) || null,
    eventName,
    module: "engagements",
    source: "engagement_flow",
    requestId: flowId,
    properties: {
      entryPoint,
      ...(step ? { step } : {}),
      ...(body?.scopeMode === "project" || body?.scopeMode === "agreement" ? { scopeMode: body.scopeMode } : {}),
      billingIncluded: body?.billingIncluded === true,
    },
  });
  return NextResponse.json({ success: true });
}
