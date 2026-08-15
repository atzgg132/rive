import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";

export const ANONYMOUS_ID_COOKIE = "rive_anonymous_id";
export const ATTRIBUTION_COOKIE = "rive_attribution";

export type Attribution = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  referrer?: string | null;
  landingPage?: string | null;
  firstSource?: string | null;
  firstMedium?: string | null;
  firstCampaign?: string | null;
  firstReferrer?: string | null;
  firstLandingPage?: string | null;
  lastSource?: string | null;
  lastMedium?: string | null;
  lastCampaign?: string | null;
  lastReferrer?: string | null;
  lastLandingPage?: string | null;
  referralSource?: string | null;
};

function clean(value: unknown, max = 240): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
}

export function getAnonymousId(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ANONYMOUS_ID_COOKIE}=([^;]+)`));
  return match ? clean(decodeURIComponent(match[1] || ""), 100) : null;
}

export function readAttributionCookie(request: Request): Attribution {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ATTRIBUTION_COOKIE}=([^;]+)`));
  if (!match?.[1]) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as Record<string, unknown>;
    const firstSource = clean(parsed.firstSource) || clean(parsed.source);
    const firstMedium = clean(parsed.firstMedium) || clean(parsed.medium);
    const firstCampaign = clean(parsed.firstCampaign) || clean(parsed.campaign);
    const firstReferrer = clean(parsed.firstReferrer) || clean(parsed.referrer);
    const firstLandingPage = clean(parsed.firstLandingPage, 500) || clean(parsed.landingPage, 500);
    const lastSource = clean(parsed.lastSource) || clean(parsed.source) || firstSource;
    const lastMedium = clean(parsed.lastMedium) || clean(parsed.medium) || firstMedium;
    const lastCampaign = clean(parsed.lastCampaign) || clean(parsed.campaign) || firstCampaign;
    const lastReferrer = clean(parsed.lastReferrer) || clean(parsed.referrer) || firstReferrer;
    const lastLandingPage = clean(parsed.lastLandingPage, 500) || clean(parsed.landingPage, 500) || firstLandingPage;
    return {
      source: lastSource,
      medium: lastMedium,
      campaign: lastCampaign,
      referrer: lastReferrer,
      landingPage: lastLandingPage,
      firstSource,
      firstMedium,
      firstCampaign,
      firstReferrer,
      firstLandingPage,
      lastSource,
      lastMedium,
      lastCampaign,
      lastReferrer,
      lastLandingPage,
      referralSource: clean(parsed.referralSource),
    };
  } catch {
    return {};
  }
}

export function attributionFromRequest(request: Request): { anonymousId: string | null; attribution: Attribution } {
  return { anonymousId: getAnonymousId(request), attribution: readAttributionCookie(request) };
}

export async function saveUserAttribution(
  userId: string,
  attribution: Attribution,
  client: typeof prisma | Prisma.TransactionClient = prisma,
): Promise<void> {
  if (!Object.values(attribution).some(Boolean)) return;
  const firstSource = attribution.firstSource ?? attribution.source ?? null;
  const firstMedium = attribution.firstMedium ?? attribution.medium ?? null;
  const firstCampaign = attribution.firstCampaign ?? attribution.campaign ?? null;
  const firstReferrer = attribution.firstReferrer ?? attribution.referrer ?? null;
  const firstLandingPage = attribution.firstLandingPage ?? attribution.landingPage ?? null;
  const lastSource = attribution.lastSource ?? attribution.source ?? null;
  const lastMedium = attribution.lastMedium ?? attribution.medium ?? null;
  const lastCampaign = attribution.lastCampaign ?? attribution.campaign ?? null;
  const lastReferrer = attribution.lastReferrer ?? attribution.referrer ?? null;
  const lastLandingPage = attribution.lastLandingPage ?? attribution.landingPage ?? null;
  await client.userAttribution.upsert({
    where: { userId },
    create: {
      userId,
      firstTouchSource: firstSource,
      firstTouchMedium: firstMedium,
      firstTouchCampaign: firstCampaign,
      firstTouchReferrer: firstReferrer,
      firstTouchLandingPage: firstLandingPage,
      lastTouchSource: lastSource,
      lastTouchMedium: lastMedium,
      lastTouchCampaign: lastCampaign,
      lastTouchReferrer: lastReferrer,
      lastTouchLandingPage: lastLandingPage,
      referralSource: attribution.referralSource || null,
    },
    update: {
      lastTouchSource: lastSource || undefined,
      lastTouchMedium: lastMedium || undefined,
      lastTouchCampaign: lastCampaign || undefined,
      lastTouchReferrer: lastReferrer || undefined,
      lastTouchLandingPage: lastLandingPage || undefined,
      referralSource: attribution.referralSource || undefined,
    },
  });
}
