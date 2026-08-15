import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";

export const PRODUCT_EVENTS = {
  pageViewed: "page_viewed",
  landingViewed: "landing_viewed",
  signupStarted: "signup_started",
  signupCompleted: "signup_completed",
  emailVerificationSent: "email_verification_sent",
  emailVerified: "email_verified",
  onboardingStarted: "onboarding_started",
  onboardingCompleted: "onboarding_completed",
  goalSelected: "goal_selected",
  startingPathSelected: "starting_path_selected",
  clientCreated: "client_created",
  projectCreated: "project_created",
  invoiceCreated: "invoice_created",
  invoiceSent: "invoice_sent",
  calendarUsed: "calendar_used",
  expenseCreated: "expense_created",
  importReviewCompleted: "import_review_completed",
  importCommitted: "import_committed",
  portfolioPublished: "portfolio_published",
  agreementReviewed: "agreement_reviewed",
  agreementAccepted: "agreement_accepted",
  workspaceViewed: "workspace_viewed",
  feedbackPromptShown: "feedback_prompt_shown",
  feedbackSubmitted: "feedback_submitted",
  invoiceViewed: "invoice_viewed",
  paymentRecorded: "payment_recorded",
} as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[keyof typeof PRODUCT_EVENTS] | (string & {});

export type ProductEventInput = {
  userId?: string | null;
  anonymousId?: string | null;
  sessionId?: string | null;
  eventName: ProductEventName;
  eventVersion?: number;
  occurredAt?: Date;
  module?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dataOrigin?: string | null;
  source?: string | null;
  requestId?: string | null;
  dedupeKey?: string | null;
  properties?: Record<string, unknown> | null;
};

type EventDbClient = typeof prisma | Prisma.TransactionClient;

const forbiddenPropertyKey = /(email|password|token|secret|authorization|cookie|invoice|content|body|phone|address|payload|credential)/i;

function safePropertyValue(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (depth > 2 || value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.slice(0, 160);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => safePropertyValue(entry, depth + 1) ?? null) as Prisma.InputJsonValue;
  }
  if (typeof value === "object") {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
      if (forbiddenPropertyKey.test(key)) continue;
      const safe = safePropertyValue(entry, depth + 1);
      if (safe !== undefined) result[key.slice(0, 80)] = safe;
    }
    return result;
  }
  return undefined;
}

export function sanitizeEventProperties(properties?: Record<string, unknown> | null): Prisma.InputJsonValue | undefined {
  if (!properties) return undefined;
  return safePropertyValue(properties) || undefined;
}

export function analyticsEnvironment(): string {
  return (process.env.APP_ENV || process.env.NODE_ENV || "local").toLowerCase();
}

export async function recordProductEvent(input: ProductEventInput, client: EventDbClient = prisma): Promise<void> {
  if (!input.eventName || input.eventName.length > 120) return;
  try {
    await client.productEvent.create({
      data: {
        userId: input.userId || null,
        anonymousId: input.anonymousId || null,
        sessionId: input.sessionId || null,
        eventName: input.eventName,
        eventVersion: input.eventVersion || 1,
        occurredAt: input.occurredAt || new Date(),
        environment: analyticsEnvironment(),
        module: input.module || null,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        dataOrigin: input.dataOrigin || null,
        source: input.source || null,
        requestId: input.requestId || null,
        dedupeKey: input.dedupeKey || null,
        properties: sanitizeEventProperties(input.properties),
      },
    });
  } catch (error) {
    // Product analytics must never make a successful business mutation fail.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    console.warn("product event could not be recorded:", error instanceof Error ? error.message : error);
  }
}
