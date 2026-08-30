import { NextRequest, NextResponse } from "next/server";
import { createClientEngagement, EngagementInputError, parseStartEngagementInput } from "@/utils/engagements";
import { ensureDefaultCalendar } from "@/utils/calendar";
import { ensurePrefilledPortfolio } from "@/utils/portfolioProvisioning";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { getSessionUser } from "@/utils/userAuth";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized.", code: "unauthorized" }, { status: 401 });
  if (!rateLimit(`start-engagement:${session.userId}:${getRequestIp(request)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many attempts. Please try again later.", code: "rate_limited" }, { status: 429 });
  }

  let input;
  try {
    input = parseStartEngagementInput(await request.json().catch(() => null));
    const result = await createClientEngagement(session.userId, input);
    const sharedEvent = {
      userId: session.userId,
      sessionId: input.sessionId,
      dataOrigin: "user",
      source: "engagement_flow",
      requestId: input.flowId,
    } as const;
    await Promise.all([
      ensureDefaultCalendar(session.userId).catch((error) => console.warn("Engagement calendar provisioning failed:", error)),
      ensurePrefilledPortfolio(session.userId).catch((error) => console.warn("Engagement portfolio provisioning failed:", error)),
      recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstClientCreated, { source: "engagement_flow" }),
      recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstProjectCreated, { source: "engagement_flow" }),
      recordProductEvent({ ...sharedEvent, eventName: PRODUCT_EVENTS.clientCreated, module: "clients", entityType: "client", entityId: result.records.clientId, dedupeKey: `engagement:${session.userId}:${input.flowId}:client_created` }),
      recordProductEvent({ ...sharedEvent, eventName: PRODUCT_EVENTS.projectCreated, module: "projects", entityType: "project", entityId: result.records.projectId, dedupeKey: `engagement:${session.userId}:${input.flowId}:project_created` }),
      ...(result.records.invoiceId
        ? [recordProductEvent({ ...sharedEvent, eventName: PRODUCT_EVENTS.invoiceCreated, module: "invoices", entityType: "invoice", entityId: result.records.invoiceId, dedupeKey: `engagement:${session.userId}:${input.flowId}:invoice_created` })]
        : []),
      recordProductEvent({
        ...sharedEvent,
        eventName: PRODUCT_EVENTS.engagementCreated,
        module: "engagements",
        entityType: "project",
        entityId: result.records.projectId,
        dedupeKey: `engagement:${session.userId}:${input.flowId}:created`,
        properties: {
          entryPoint: input.entryPoint,
          scopeMode: input.scopeMode,
          billingIncluded: Boolean(input.invoice),
          agreementIncluded: Boolean(result.records.contractId),
        },
      }),
      ...(input.entryPoint === "onboarding"
        ? [recordProductEvent({ userId: session.userId, sessionId: input.sessionId, eventName: PRODUCT_EVENTS.onboardingCompleted, module: "onboarding", dedupeKey: `onboarding_completed:${session.userId}` })]
        : []),
    ]);
    return NextResponse.json({ success: true, records: result.records, nextAction: result.nextAction }, { status: 201 });
  } catch (error) {
    const known = error instanceof EngagementInputError;
    const code = known ? error.code : "creation_failed";
    if (input) {
      await recordProductEvent({
        userId: session.userId,
        sessionId: input.sessionId,
        eventName: PRODUCT_EVENTS.engagementCreateFailed,
        module: "engagements",
        source: "engagement_flow",
        requestId: input.flowId,
        dedupeKey: `engagement:${session.userId}:${input.flowId}:failed:${code}`,
        properties: { entryPoint: input.entryPoint, failureCode: code },
      });
    }
    if (!known) console.error("Start engagement failed:", error);
    return NextResponse.json(
      { success: false, message: known ? error.message : "The engagement could not be created. Nothing was changed.", code },
      { status: known ? error.status : 500 },
    );
  }
}
