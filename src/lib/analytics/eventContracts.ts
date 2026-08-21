/**
 * Source-of-truth contracts for first-party product events.
 *
 * `eventVersion` is the version of an individual event payload. The envelope
 * `schemaVersion` is the version of this shared record shape. Additive changes
 * can keep a version; changes to meaning or required fields must increment it.
 */
export const PRODUCT_EVENT_SCHEMA_VERSION = 1;

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

type CoreProductEventName = (typeof PRODUCT_EVENTS)[keyof typeof PRODUCT_EVENTS];
export type ProductEventName = CoreProductEventName
  | "activation.registered"
  | "activation.onboarding_started"
  | "activation.profile_substantially_completed"
  | "activation.portfolio_published"
  | "activation.first_client_created"
  | "activation.first_project_created"
  | "activation.first_meaningful_workflow_completed"
  | "guidance.started"
  | "guidance.skipped"
  | "guidance.completed"
  | "guidance.replayed"
  | "guidance.minimized"
  | "guidance.resumed"
  | "guidance.step_opened";

export const ACTIVATION_EVENT_NAMES = new Set([
  "activation.registered",
  "activation.onboarding_started",
  "activation.profile_substantially_completed",
  "activation.portfolio_published",
  "activation.first_client_created",
  "activation.first_project_created",
  "activation.first_meaningful_workflow_completed",
  "guidance.started",
  "guidance.skipped",
  "guidance.completed",
  "guidance.replayed",
  "guidance.minimized",
  "guidance.resumed",
  "guidance.step_opened",
]);

export const REAL_DATA_ORIGINS = new Set(["user", "imported"]);

export const REAL_DATA_EVENT_NAMES = new Set<string>([
  PRODUCT_EVENTS.clientCreated,
  PRODUCT_EVENTS.projectCreated,
  PRODUCT_EVENTS.invoiceCreated,
  PRODUCT_EVENTS.expenseCreated,
  PRODUCT_EVENTS.importCommitted,
  PRODUCT_EVENTS.portfolioPublished,
]);

type ContractRequirement = "identity" | "module" | "entity" | "dataOrigin";

export type ProductEventContract = {
  version: number;
  requirements: readonly ContractRequirement[];
  description: string;
};

const identityAndModule = ["identity", "module"] as const satisfies readonly ContractRequirement[];
const entityEvent = ["identity", "module", "entity"] as const satisfies readonly ContractRequirement[];
const realDataEntityEvent = ["identity", "module", "entity", "dataOrigin"] as const satisfies readonly ContractRequirement[];

export const PRODUCT_EVENT_CONTRACTS: Record<ProductEventName, ProductEventContract> = {
  page_viewed: { version: 1, requirements: identityAndModule, description: "A page or workspace route was viewed." },
  landing_viewed: { version: 1, requirements: identityAndModule, description: "The marketing landing page was viewed." },
  signup_started: { version: 1, requirements: identityAndModule, description: "A visitor started signup." },
  signup_completed: { version: 1, requirements: ["identity", "module"], description: "A new account was created." },
  email_verification_sent: { version: 1, requirements: ["identity", "module"], description: "A verification email was queued or resent." },
  email_verified: { version: 1, requirements: ["identity", "module"], description: "A new account verified its email." },
  onboarding_started: { version: 1, requirements: identityAndModule, description: "Onboarding was started or advanced." },
  onboarding_completed: { version: 1, requirements: identityAndModule, description: "Onboarding reached complete or skipped state." },
  goal_selected: { version: 1, requirements: identityAndModule, description: "A primary goal was selected." },
  starting_path_selected: { version: 1, requirements: identityAndModule, description: "A starting path was selected." },
  client_created: { version: 1, requirements: realDataEntityEvent, description: "A real client record was created." },
  project_created: { version: 1, requirements: realDataEntityEvent, description: "A real project record was created." },
  invoice_created: { version: 1, requirements: realDataEntityEvent, description: "A real invoice record was created." },
  invoice_sent: { version: 1, requirements: entityEvent, description: "An invoice was sent." },
  calendar_used: { version: 1, requirements: realDataEntityEvent, description: "A real calendar event was created or connected." },
  expense_created: { version: 1, requirements: realDataEntityEvent, description: "A real expense record was created." },
  import_review_completed: { version: 1, requirements: ["identity", "module"], description: "An import review was completed." },
  import_committed: { version: 1, requirements: realDataEntityEvent, description: "Real imported records were committed." },
  portfolio_published: { version: 1, requirements: realDataEntityEvent, description: "A portfolio with real work was published." },
  agreement_reviewed: { version: 1, requirements: entityEvent, description: "An Agreement review was issued or opened." },
  agreement_accepted: { version: 1, requirements: entityEvent, description: "An Agreement was accepted." },
  workspace_viewed: { version: 1, requirements: identityAndModule, description: "An authenticated workspace surface was viewed." },
  feedback_prompt_shown: { version: 1, requirements: identityAndModule, description: "An in-app feedback prompt was shown." },
  feedback_submitted: { version: 1, requirements: identityAndModule, description: "A feedback response was submitted." },
  invoice_viewed: { version: 1, requirements: entityEvent, description: "A public invoice was viewed." },
  payment_recorded: { version: 1, requirements: entityEvent, description: "A payment was recorded against an invoice." },
  "activation.registered": { version: 1, requirements: identityAndModule, description: "The registered activation milestone was recorded." },
  "activation.onboarding_started": { version: 1, requirements: identityAndModule, description: "The onboarding activation milestone was recorded." },
  "activation.profile_substantially_completed": { version: 1, requirements: identityAndModule, description: "The profile activation milestone was recorded." },
  "activation.portfolio_published": { version: 1, requirements: identityAndModule, description: "The portfolio activation milestone was recorded." },
  "activation.first_client_created": { version: 1, requirements: identityAndModule, description: "The first-client activation milestone was recorded." },
  "activation.first_project_created": { version: 1, requirements: identityAndModule, description: "The first-project activation milestone was recorded." },
  "activation.first_meaningful_workflow_completed": { version: 1, requirements: identityAndModule, description: "The first meaningful workflow activation milestone was recorded." },
  "guidance.started": { version: 1, requirements: identityAndModule, description: "Product guidance was started." },
  "guidance.skipped": { version: 1, requirements: identityAndModule, description: "Product guidance was skipped." },
  "guidance.completed": { version: 1, requirements: identityAndModule, description: "Product guidance was completed." },
  "guidance.replayed": { version: 1, requirements: identityAndModule, description: "Product guidance was replayed." },
  "guidance.minimized": { version: 1, requirements: identityAndModule, description: "An active guide was minimized." },
  "guidance.resumed": { version: 1, requirements: identityAndModule, description: "A minimized guide was resumed." },
  "guidance.step_opened": { version: 1, requirements: identityAndModule, description: "A guide's recommended step was opened." },
};

export const PRODUCT_EVENT_NAMES = new Set<string>([
  ...Object.values(PRODUCT_EVENTS),
  ...ACTIVATION_EVENT_NAMES,
]);

export type ProductEventValidationInput = {
  eventName: string;
  eventVersion?: number;
  schemaVersion?: number;
  userId?: string | null;
  anonymousId?: string | null;
  module?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dataOrigin?: string | null;
};

export type ProductEventValidation =
  | { ok: true; contract: ProductEventContract }
  | { ok: false; reasons: string[]; contract: ProductEventContract | null };

export function getProductEventContract(eventName: string): ProductEventContract | null {
  return PRODUCT_EVENT_CONTRACTS[eventName as ProductEventName] || null;
}

export function validateProductEvent(input: ProductEventValidationInput): ProductEventValidation {
  const contract = getProductEventContract(input.eventName);
  const reasons: string[] = [];
  if (!contract) reasons.push("unknown_event_name");
  if (!Number.isInteger(input.eventVersion ?? 1) || (input.eventVersion ?? 1) < 1) reasons.push("invalid_event_version");
  if ((input.eventVersion ?? 1) !== contract?.version) reasons.push("unsupported_event_version");
  if ((input.schemaVersion ?? PRODUCT_EVENT_SCHEMA_VERSION) !== PRODUCT_EVENT_SCHEMA_VERSION) reasons.push("unsupported_schema_version");
  if (contract?.requirements.includes("identity") && !input.userId && !input.anonymousId) reasons.push("missing_identity");
  if (contract?.requirements.includes("module") && !input.module?.trim()) reasons.push("missing_module");
  if (contract?.requirements.includes("entity") && (!input.entityType?.trim() || !input.entityId?.trim())) reasons.push("missing_entity");
  if (contract?.requirements.includes("dataOrigin") && (!input.dataOrigin || !REAL_DATA_ORIGINS.has(input.dataOrigin))) reasons.push("missing_or_invalid_data_origin");
  return reasons.length || !contract ? { ok: false, reasons, contract } : { ok: true, contract };
}
