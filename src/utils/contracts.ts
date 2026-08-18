import "server-only";

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { buildContractStatusUpdate, type ContractStatus } from "@/utils/contractStatus";
import { getRequestIp } from "@/utils/rateLimit";

export {
  assertValidStatusTransition,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_TRANSITIONS,
} from "@/utils/contractStatus";
export type { ContractStatus } from "@/utils/contractStatus";

export const CONTRACT_CONSENT_TEXT_VERSION = "2026-08-03-v2";
export const CONTRACT_CONSENT_TEXT = "I confirm that I have read and approve this exact Agreement version, and that I am authorised to act for myself or the named organisation. I consent to Rive recording my typed-name acceptance, the displayed timestamp, and the associated acceptance evidence. I understand that this record describes the method used and is not an OTP or identity-verification result.";
export const CONTRACT_TOKEN_TTL_DAYS = 14;
export const CONTRACT_MAX_COMMENT_LENGTH = 4_000;
export const CONTRACT_MAX_TITLE_LENGTH = 180;

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
    title: "11. Acceptance record and electronic records",
    required: true,
    enabled: true,
    body: "The parties consent to Rive recording their typed-name acceptance of this specific Agreement version, together with the displayed timestamp, consent text, and associated acceptance evidence. This record describes the acceptance method and is not an OTP or identity-verification result. Each party confirms that they have authority to act for themselves or the named organisation. The parties may retain and present the Agreement and its electronic records as evidence, subject to applicable law and any required formalities.",
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
  return sha256(`${getContractHashSecret()}:${token}`);
}

export function createAccessToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashRequestValue(value: string): string {
  return sha256(`${getContractHashSecret()}:${value}`);
}

function getContractHashSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required for Contract links and telemetry in production.");
  return "rive-contract-development-only-salt";
}

// Re-exported rather than reimplemented. This used to be a second copy of the
// same logic, which meant a fix to how the client address is derived could land
// in one file and silently miss every caller of the other.
export { getRequestIp };

export function getRequestId(request: Request): string {
  const candidate = request.headers.get("x-request-id")?.trim() || "";
  return /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : crypto.randomUUID();
}

export type ContractPublicLinkPurpose = "review" | "acceptance" | "artifact";

export function classifyContractPublicLinkFailure(message: string | null): string {
  if (!message) return "allowed";
  if (message.includes("not found")) return "not_found";
  if (message.includes("revoked")) return "revoked";
  if (message.includes("expired")) return "expired";
  if (message.includes("voided")) return "voided";
  return "invalid";
}

export function logContractPublicLinkAccess(input: {
  request: Request;
  requestId: string;
  purpose: ContractPublicLinkPurpose;
  contractId: string | null;
  versionId: string | null;
  outcome: string;
  revoked: boolean | null;
  expired: boolean | null;
  rateLimited: boolean;
}): void {
  const userAgent = input.request.headers.get("user-agent") || "unknown";
  console.info("contract_public_link_access", JSON.stringify({
    requestId: input.requestId,
    purpose: input.purpose,
    contractId: input.contractId,
    versionId: input.versionId,
    outcome: input.outcome,
    revoked: input.revoked,
    expired: input.expired,
    rateLimited: input.rateLimited,
    ipHash: hashRequestValue(getRequestIp(input.request)),
    userAgentHash: hashRequestValue(userAgent),
    at: new Date().toISOString(),
  }));
}

export const LOCAL_ESIGN_PROVIDER = "local";
export const RIVE_ESIGN_PROVIDER = "rive";
export const CONTRACTS_RECORDED_ACCEPTANCE_FLAG = "CONTRACTS_RECORDED_ACCEPTANCE_ENABLED";
export const CONTRACTS_ALLOW_LOCAL_PROVIDER_FLAG = "CONTRACTS_ALLOW_LOCAL_PROVIDER_IN_PRODUCTION";

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

export function isRecordedAcceptanceEnabled(): boolean {
  return process.env[CONTRACTS_RECORDED_ACCEPTANCE_FLAG] === "true";
}

export function assertContractsEnabled(): void {
  if (process.env.CONTRACTS_ENABLED === "false") {
    throw new Error("Contracts are disabled for this environment.");
  }
  const provider = getConfiguredEsignProvider();
  if (![LOCAL_ESIGN_PROVIDER, RIVE_ESIGN_PROVIDER].includes(provider)) {
    throw new Error("Contract signing provider is not configured.");
  }
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET?.trim()) {
    throw new Error("SESSION_SECRET is required before Contracts can run in production.");
  }
  if (process.env.NODE_ENV === "production" && provider === LOCAL_ESIGN_PROVIDER && process.env[CONTRACTS_ALLOW_LOCAL_PROVIDER_FLAG] !== "true") {
    throw new Error("The local/demo Contract provider is disabled in production unless explicitly enabled.");
  }
  if (process.env.NODE_ENV === "production" && provider === RIVE_ESIGN_PROVIDER && !isRecordedAcceptanceEnabled()) {
    throw new Error("The recorded-acceptance adapter is disabled in production until its feature flag is explicitly enabled.");
  }
}

export function contractsAvailable(): boolean {
  try {
    assertContractsEnabled();
    return true;
  } catch {
    return false;
  }
}

type ContractStatusWriteClient = {
  contract: {
    updateMany(args: Prisma.ContractUpdateManyArgs): Promise<{ count: number }>;
  };
};

type ProjectCoverageWriteClient = {
  contract: {
    count(args: Prisma.ContractCountArgs): Promise<number>;
  };
  project: {
    updateMany(args: Prisma.ProjectUpdateManyArgs): Promise<{ count: number }>;
  };
};

export async function transitionContractStatus(
  db: ContractStatusWriteClient,
  input: {
    where: Prisma.ContractWhereInput;
    from: string;
    to: ContractStatus;
    data?: Omit<Prisma.ContractUpdateManyMutationInput, "status">;
  },
): Promise<number> {
  const update = buildContractStatusUpdate({
    where: input.where,
    from: input.from,
    to: input.to,
    data: input.data,
  });
  const result = await db.contract.updateMany({
    where: update.where,
    data: update.data,
  });
  return result.count;
}

export async function resetProjectCoverageIfNoActiveContracts(
  db: ProjectCoverageWriteClient,
  projectId: string,
  userId: string,
): Promise<void> {
  const remainingContracts = await db.contract.count({
    where: { projectId, status: { not: "void" } },
  });
  if (remainingContracts !== 0) return;
  await db.project.updateMany({
    where: { id: projectId, userId, contractCoverage: "rive" },
    data: { contractCoverage: "undecided", contractDecisionAt: null },
  });
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
