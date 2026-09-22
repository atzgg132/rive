import "server-only";

import { normalizeEmailAddress, type NormalizedEmailAddress } from "@/lib/email-address";
import { sanitizeEmailDiagnostic } from "@/utils/email";

type EmailEventKind = "BOUNCE" | "COMPLAINT" | "DELIVERY" | "REJECT";

export type ProviderEmailEvent = {
  kind: EmailEventKind;
  messageId: string;
  recipients: NormalizedEmailAddress[];
  status: "delivered" | "delivery_failed";
  reason: string | null;
  suppressRecipients: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanProviderText(value: unknown, limit = 500): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return sanitizeEmailDiagnostic(value).slice(0, limit);
}

function reasonFor(kind: EmailEventKind, event: Record<string, unknown>): string | null {
  if (kind === "DELIVERY") return null;
  const detail = event[kind.toLowerCase()];
  if (!isRecord(detail)) return kind.toLowerCase();
  const parts = [
    cleanProviderText(detail.bounceType),
    cleanProviderText(detail.bounceSubType),
    cleanProviderText(detail.complaintFeedbackType),
    cleanProviderText(detail.diagnosticCode),
    cleanProviderText(detail.reason),
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(":") : kind.toLowerCase();
}

export function parseProviderEmailEvent(value: unknown): ProviderEmailEvent | null {
  if (!isRecord(value)) return null;
  const kindValue = value.eventType;
  if (kindValue !== "BOUNCE" && kindValue !== "COMPLAINT" && kindValue !== "DELIVERY" && kindValue !== "REJECT") return null;
  const mail = value.mail;
  if (!isRecord(mail) || typeof mail.messageId !== "string" || !mail.messageId.trim()) return null;

  const destination = Array.isArray(mail.destination) ? mail.destination : [];
  const recipients = [...new Set(destination.map(normalizeEmailAddress).filter((email): email is NormalizedEmailAddress => Boolean(email)))];
  const failed = kindValue !== "DELIVERY";
  return {
    kind: kindValue,
    messageId: mail.messageId.trim(),
    recipients,
    status: failed ? "delivery_failed" : "delivered",
    reason: reasonFor(kindValue, value),
    suppressRecipients: kindValue === "BOUNCE" || kindValue === "COMPLAINT",
  };
}
