/**
 * Versioned product-funnel rules. Keep the admin dashboard, user explorer, and
 * future warehouse export on this contract instead of re-implementing it in
 * individual routes.
 */
export const FUNNEL_DEFINITION_VERSION = "v1";

export const INTERNAL_ACCOUNT_TYPES = new Set(["internal", "test", "demo", "e2e", "synthetic"]);
export const REAL_DATA_ORIGINS = new Set(["user", "imported"]);
export const REAL_DATA_EVENT_NAMES = new Set([
  "client_created",
  "project_created",
  "invoice_created",
  "expense_created",
  "import_committed",
  "portfolio_published",
]);
export const MEANINGFUL_PRODUCT_EVENTS = new Set([
  "workspace_viewed",
  ...REAL_DATA_EVENT_NAMES,
  "invoice_sent",
  "calendar_used",
  "import_review_completed",
  "agreement_reviewed",
  "agreement_accepted",
  "invoice_viewed",
  "payment_recorded",
]);

type AttributionLike = {
  firstTouchSource: string | null;
  lastTouchSource: string | null;
  referralSource: string | null;
} | null;

export type QualificationUser = {
  accountType?: string | null;
  emailVerifiedAt: Date | null;
  emailVerificationRequiredAt: Date | null;
  onboardingStatus: string;
  businessType: string | null;
  profession: string | null;
  onboardingData: unknown;
  attribution: AttributionLike;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function acquisitionSource(user: Pick<QualificationUser, "attribution">): string {
  return user.attribution?.firstTouchSource || user.attribution?.lastTouchSource || user.attribution?.referralSource || "uncaptured";
}

export function isQualifiedUser(user: QualificationUser): boolean {
  if (user.accountType && INTERNAL_ACCOUNT_TYPES.has(user.accountType)) return false;
  const onboarding = isRecord(user.onboardingData) ? user.onboardingData : {};
  const emailReady = !user.emailVerificationRequiredAt || Boolean(user.emailVerifiedAt);
  return emailReady
    && ["complete", "skipped"].includes(user.onboardingStatus)
    && Boolean(user.businessType?.trim())
    && Boolean(user.profession?.trim())
    && typeof onboarding.goal === "string"
    && Boolean(onboarding.goal.trim())
    && typeof onboarding.startingPath === "string"
    && Boolean(onboarding.startingPath.trim())
    && acquisitionSource(user) !== "uncaptured";
}

export function isMeaningfulProductEvent(event: { eventName: string; properties: unknown }): boolean {
  if (event.eventName !== "page_viewed") return MEANINGFUL_PRODUCT_EVENTS.has(event.eventName);
  const properties = isRecord(event.properties) ? event.properties : {};
  const path = typeof properties.path === "string" ? properties.path : "";
  return ["/dashboard", "/workflow", "/calendar", "/portfolio"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isRealDataEvent(event: { eventName: string; dataOrigin?: string | null }): boolean {
  return Boolean(event.dataOrigin && REAL_DATA_ORIGINS.has(event.dataOrigin) && REAL_DATA_EVENT_NAMES.has(event.eventName));
}
