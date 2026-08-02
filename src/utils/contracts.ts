import "server-only";

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";

export const CONTRACT_CONSENT_TEXT_VERSION = "2026-07-31-v1";
export const CONTRACT_CONSENT_TEXT = "I consent to use an electronic signature, confirm that I have read and approve this exact contract version, and confirm that I am authorised to sign for myself or the named organisation. I intend my signature to create a binding signature record.";
export const CONTRACT_TOKEN_TTL_DAYS = 14;
export const CONTRACT_MAX_COMMENT_LENGTH = 4_000;
export const CONTRACT_MAX_TITLE_LENGTH = 180;

export const CONTRACT_STATUSES = [
  "draft",
  "in_review",
  "ready_to_sign",
  "signing",
  "executed",
  "declined",
  "void",
  "expired",
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const PAYMENT_TRIGGER_TYPES = [
  "on_signing",
  "milestone_completed",
  "milestone_due",
  "fixed_date",
] as const;

export type PaymentTriggerType = (typeof PAYMENT_TRIGGER_TYPES)[number];

export type ContractSection = {
  key: string;
  title: string;
  body: string;
  enabled: boolean;
  required?: boolean;
};

export type ContractPaymentSnapshot = {
  id: string;
  label: string;
  amount: string;
  currency: string;
  triggerType: PaymentTriggerType;
  triggerDate: string | null;
  dueDays: number;
  milestoneId: string | null;
  milestoneTitle: string | null;
  invoiceDescription: string | null;
  sequence: number;
};

export type ContractContent = {
  schemaVersion: 1;
  documentType: "freelance-services";
  title: string;
  ownerName: string;
  ownerEmail: string;
  clientName: string;
  clientEmail: string | null;
  clientCompany?: string | null;
  clientAddress?: string | null;
  projectTitle?: string | null;
  projectDescription?: string | null;
  governingLaw?: string;
  jurisdiction?: string | null;
  sections: ContractSection[];
  paymentPlan: {
    currency: string;
    items: ContractPaymentSnapshot[];
  };
};

const REQUIRED_SECTION_KEYS = new Set(["scope", "fees", "electronic-signatures"]);

export const DEFAULT_CONTRACT_SECTIONS: ContractSection[] = [
  {
    key: "scope",
    title: "1. Scope of services",
    required: true,
    enabled: true,
    body: "The freelancer will provide the services and deliverables described in the agreed project brief, together with any milestones recorded in this contract. Work outside that scope requires a written change agreed by both parties.",
  },
  {
    key: "acceptance",
    title: "2. Deliverables and acceptance",
    enabled: true,
    body: "The client will review each deliverable within 5 business days of delivery and either accept it or identify specific, reasonable changes required to bring it into line with the agreed scope. A deliverable is accepted when the client confirms acceptance in writing or uses it in production without raising a written objection.",
  },
  {
    key: "fees",
    title: "3. Fees and payment",
    required: true,
    enabled: true,
    body: "The fees, payment triggers, currency, and invoice due periods are set out in the payment plan below. The freelancer may pause work on amounts that are overdue after giving written notice. Taxes, withholding, bank charges, and currency conversion costs will be handled as required by applicable law and the parties’ agreed arrangement.",
  },
  {
    key: "changes",
    title: "4. Changes and additional work",
    enabled: true,
    body: "A change to scope, schedule, assumptions, or deliverables is effective only when the parties record the change in writing, including any fee or timeline adjustment. Silence or a review comment does not by itself approve additional paid work.",
  },
  {
    key: "ip",
    title: "5. Intellectual property",
    enabled: true,
    body: "Upon payment in full for the relevant deliverable, the freelancer grants or assigns to the client the rights expressly described in the project brief. The freelancer retains ownership of pre-existing materials, general know-how, tools, templates, and reusable components, and grants the client a licence to any such materials incorporated into the deliverables to the extent needed to use the deliverables.",
  },
  {
    key: "confidentiality",
    title: "6. Confidentiality",
    enabled: false,
    body: "Each party will protect the other party’s non-public information with reasonable care, use it only for this engagement, and disclose it only to people who need it for the engagement and are bound to protect it. This obligation does not apply to information that is public without breach, already known lawfully, independently developed, or required to be disclosed by law.",
  },
  {
    key: "independent-contractor",
    title: "7. Independent contractor relationship",
    enabled: true,
    body: "The freelancer is an independent contractor and not an employee, partner, agent, or joint venturer of the client. The freelancer controls the manner and means of performing the services, subject to the agreed deliverables, deadlines, and lawful client requirements.",
  },
  {
    key: "warranties",
    title: "8. Warranties and limitation of liability",
    enabled: true,
    body: "Each party represents that it has authority to enter into this contract. Except for those express representations, the services and deliverables are provided to the extent described in the agreed scope. To the maximum extent permitted by applicable law, neither party will be liable for indirect, incidental, special, consequential, or lost-profit damages, and the freelancer’s aggregate liability will not exceed the fees paid or payable under this contract, except for liability that cannot lawfully be limited.",
  },
  {
    key: "termination",
    title: "9. Termination",
    enabled: true,
    body: "Either party may terminate this contract for material breach if the breach is not cured within 10 business days after written notice, unless a shorter period is required by the circumstances or applicable law. The client will pay for services performed and approved expenses incurred up to termination. Clauses intended to survive termination will continue to apply.",
  },
  {
    key: "disputes",
    title: "10. Governing law and disputes",
    enabled: true,
    body: "This contract is governed by the governing law and jurisdiction selected in the contract record, without regard to conflict-of-law rules. The parties will first try in good faith to resolve a dispute through a written discussion before starting formal proceedings, unless urgent relief or a statutory remedy is required.",
  },
  {
    key: "electronic-signatures",
    title: "11. Electronic signatures and counterparts",
    required: true,
    enabled: true,
    body: "The parties consent to sign this contract electronically. A signature applied through the signing process is intended to identify the signer, evidence the signer’s approval of this specific version, and have the same contractual effect as a handwritten signature to the extent permitted by applicable law. The parties agree that electronic records, timestamps, authentication records, and the completed contract may be retained and presented as evidence. Each signer confirms that they have authority to sign for themselves or the named organisation.",
  },
];

export function createDefaultContractSections(input: {
  ownerName: string;
  clientName: string;
}): ContractSection[] {
  return DEFAULT_CONTRACT_SECTIONS.map((section) => ({
    ...section,
    body: section.body
      .replace(/the freelancer/gi, input.ownerName || "the freelancer")
      .replace(/the client/gi, input.clientName || "the client"),
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeSections(
  input: unknown,
  context: { ownerName: string; clientName: string },
): ContractSection[] {
  const fallback = createDefaultContractSections(context);
  if (!Array.isArray(input)) return fallback;

  const normalized: ContractSection[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    if (!isRecord(item)) continue;
    const key = cleanText(item.key, 80).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const title = cleanText(item.title, 160);
    const body = cleanText(item.body, 20_000);
    if (!key || !title || !body || seen.has(key)) continue;
    seen.add(key);
    const required = REQUIRED_SECTION_KEYS.has(key) || item.required === true;
    normalized.push({
      key,
      title,
      body,
      enabled: required ? true : item.enabled !== false,
      ...(required ? { required: true } : {}),
    });
  }

  const requiredSections = fallback.filter((section) => section.required);
  for (const required of requiredSections) {
    if (!normalized.some((section) => section.key === required.key)) normalized.push(required);
  }

  return normalized.length ? normalized : fallback;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashAccessToken(token: string): string {
  return sha256(`${process.env.SESSION_SECRET || "rive-contract-token-salt"}:${token}`);
}

export function createAccessToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashRequestValue(value: string): string {
  return sha256(`${process.env.SESSION_SECRET || "rive-request-salt"}:${value}`);
}

export function getRequestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export const LOCAL_ESIGN_PROVIDER = "local";
export const RIVE_ESIGN_PROVIDER = "rive";

export function getConfiguredEsignProvider(): string {
  const configured = (process.env.ESIGN_PROVIDER || "").trim().toLowerCase();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? RIVE_ESIGN_PROVIDER : LOCAL_ESIGN_PROVIDER;
}

export function isLocalEsignDemo(): boolean {
  return getConfiguredEsignProvider() === LOCAL_ESIGN_PROVIDER;
}

export function isRiveEsignProvider(): boolean {
  return getConfiguredEsignProvider() === RIVE_ESIGN_PROVIDER;
}

export function assertContractsEnabled(): void {
  if (process.env.CONTRACTS_ENABLED === "false") {
    throw new Error("Contracts are disabled for this environment.");
  }
  const provider = getConfiguredEsignProvider();
  if (![LOCAL_ESIGN_PROVIDER, RIVE_ESIGN_PROVIDER].includes(provider)) {
    throw new Error("Contract signing provider is not configured.");
  }
  if (process.env.NODE_ENV === "production" && provider === LOCAL_ESIGN_PROVIDER) {
    throw new Error("The local e-sign provider is disabled in production.");
  }
}

export function assertValidStatusTransition(current: string, next: ContractStatus): void {
  const allowed: Record<string, ContractStatus[]> = {
    draft: ["in_review", "void"],
    in_review: ["draft", "ready_to_sign", "void"],
    ready_to_sign: ["in_review", "signing", "void", "expired"],
    signing: ["void", "expired"],
    executed: ["void"],
    declined: ["in_review", "void"],
    void: [],
    expired: ["in_review", "void"],
  };
  if (!allowed[current]?.includes(next)) {
    throw new Error(`Contract cannot move from ${current} to ${next}.`);
  }
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function parseDateOrNull(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function validatePaymentPlanItem(input: unknown, index: number): {
  label: string;
  amount: number;
  currency: string;
  triggerType: PaymentTriggerType;
  triggerDate: Date | null;
  dueDays: number;
  milestoneId: string | null;
  invoiceDescription: string | null;
  sequence: number;
} {
  if (!isRecord(input)) throw new Error(`Payment plan item ${index + 1} is invalid.`);
  const label = cleanText(input.label, 160);
  const amount = typeof input.amount === "number" ? input.amount : Number(input.amount);
  const currency = cleanText(input.currency, 3).toUpperCase();
  const triggerType = input.triggerType as PaymentTriggerType;
  const parsedTriggerDate = parseDateOrNull(input.triggerDate);
  const usesMilestone = triggerType === "milestone_completed" || triggerType === "milestone_due";
  const triggerDate = triggerType === "fixed_date" || triggerType === "milestone_due" ? parsedTriggerDate : null;
  const milestoneId = usesMilestone ? cleanText(input.milestoneId, 80) || null : null;
  const dueDays = typeof input.dueDays === "number" ? input.dueDays : Number(input.dueDays ?? 7);
  const invoiceDescription = cleanText(input.invoiceDescription, 240) || null;

  if (!label) throw new Error(`Payment plan item ${index + 1} needs a label.`);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new Error(`Payment plan item ${index + 1} needs a positive amount.`);
  }
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`Payment plan item ${index + 1} needs a 3-letter currency.`);
  if (!PAYMENT_TRIGGER_TYPES.includes(triggerType)) throw new Error(`Payment plan item ${index + 1} has an invalid trigger.`);
  if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 365) throw new Error(`Payment plan item ${index + 1} has an invalid due period.`);
  if (triggerType === "fixed_date" && !triggerDate) throw new Error(`Payment plan item ${index + 1} needs a valid trigger date.`);
  if (usesMilestone && !milestoneId) {
    throw new Error(`Payment plan item ${index + 1} must be linked to a milestone.`);
  }

  return {
    label,
    amount: Math.round(amount * 100) / 100,
    currency,
    triggerType,
    triggerDate,
    dueDays,
    milestoneId,
    invoiceDescription,
    sequence: index,
  };
}

export function buildContractContent(input: {
  title: string;
  ownerName: string;
  ownerEmail: string;
  clientName: string;
  clientEmail: string | null;
  clientCompany?: string | null;
  clientAddress?: string | null;
  projectTitle?: string | null;
  projectDescription?: string | null;
  governingLaw: string;
  jurisdiction: string | null;
  sections: ContractSection[];
  paymentPlan: ContractPaymentSnapshot[];
  currency: string;
}): ContractContent {
  return {
    schemaVersion: 1,
    documentType: "freelance-services",
    title: input.title,
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    ...(input.clientCompany ? { clientCompany: input.clientCompany } : {}),
    ...(input.clientAddress ? { clientAddress: input.clientAddress } : {}),
    ...(input.projectTitle ? { projectTitle: input.projectTitle } : {}),
    ...(input.projectDescription ? { projectDescription: input.projectDescription } : {}),
    governingLaw: input.governingLaw,
    jurisdiction: input.jurisdiction,
    sections: input.sections,
    paymentPlan: {
      currency: input.currency,
      items: input.paymentPlan,
    },
  };
}

export async function logContractEvent(input: {
  contractId: string;
  versionId?: string;
  actorUserId?: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  await prisma.contractEvent.create({
    data: {
      contractId: input.contractId,
      versionId: input.versionId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      ipHash: input.ip ? hashRequestValue(input.ip) : undefined,
    },
  });
}

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  message: string;
  href?: string;
}): Promise<void> {
  await prisma.notification.create({ data: input });
}

export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
