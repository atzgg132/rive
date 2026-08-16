import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import {
  PRODUCT_EVENT_SCHEMA_VERSION,
  type ProductEventName,
  validateProductEvent,
} from "@/lib/analytics/eventContracts";

export { PRODUCT_EVENT_SCHEMA_VERSION, PRODUCT_EVENTS } from "@/lib/analytics/eventContracts";
export type { ProductEventName } from "@/lib/analytics/eventContracts";

export type ProductEventInput = {
  userId?: string | null;
  anonymousId?: string | null;
  sessionId?: string | null;
  eventName: ProductEventName | (string & {});
  eventVersion?: number;
  schemaVersion?: number;
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

export type ProductEventWriteResult = {
  accepted: boolean;
  duplicate?: boolean;
  reason?: "invalid_contract" | "invalid_event_name" | "database_error";
};

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

async function recordProductEventIssue(input: ProductEventInput, reasons: string[], client: EventDbClient): Promise<void> {
  try {
    const issueClient = (client as unknown as {
      productEventIssue?: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
    }).productEventIssue;
    if (!issueClient) return;
    await issueClient.create({
      data: {
        eventName: input.eventName || "<missing>",
        eventVersion: input.eventVersion ?? 1,
        schemaVersion: input.schemaVersion ?? PRODUCT_EVENT_SCHEMA_VERSION,
        environment: analyticsEnvironment(),
        userId: input.userId || null,
        anonymousId: input.anonymousId || null,
        requestId: input.requestId || null,
        reason: reasons.join(",").slice(0, 500),
      },
    });
  } catch (error) {
    // Contract monitoring is best-effort and must never block product work.
    console.warn("product event contract issue could not be recorded:", error instanceof Error ? error.message : error);
  }
}

export async function recordProductEvent(input: ProductEventInput, client: EventDbClient = prisma): Promise<ProductEventWriteResult> {
  if (!input.eventName || input.eventName.length > 120) {
    await recordProductEventIssue(input, ["missing_or_long_event_name"], client);
    return { accepted: false, reason: "invalid_event_name" };
  }
  const validation = validateProductEvent(input);
  if (!validation.ok) {
    await recordProductEventIssue(input, validation.reasons, client);
    return { accepted: false, reason: "invalid_contract" };
  }
  try {
    await client.productEvent.create({
      data: {
        userId: input.userId || null,
        anonymousId: input.anonymousId || null,
        sessionId: input.sessionId || null,
        eventName: input.eventName,
        eventVersion: input.eventVersion ?? validation.contract.version,
        schemaVersion: input.schemaVersion ?? PRODUCT_EVENT_SCHEMA_VERSION,
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
    return { accepted: true };
  } catch (error) {
    // Product analytics must never make a successful business mutation fail.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { accepted: true, duplicate: true };
    console.warn("product event could not be recorded:", error instanceof Error ? error.message : error);
    return { accepted: false, reason: "database_error" };
  }
}
