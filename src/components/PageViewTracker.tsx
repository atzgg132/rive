"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ANONYMOUS_COOKIE = "rive_anonymous_id";
const SESSION_COOKIE = "rive_analytics_session";
const ATTRIBUTION_COOKIE = "rive_attribution";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1] || "") : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function ensureIdentityCookie(name: string): string {
  const current = readCookie(name);
  if (current) return current;
  const value = crypto.randomUUID();
  writeCookie(name, value, 60 * 60 * 24 * 365);
  return value;
}

function updateAttribution(pathname: string): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const explicitTouch = ["utm_source", "utm_medium", "utm_campaign", "ref", "referral"].some((key) => Boolean(params.get(key)));
  let externalReferrer = false;
  try { externalReferrer = Boolean(document.referrer) && new URL(document.referrer).origin !== window.location.origin; } catch { externalReferrer = Boolean(document.referrer); }
  const hasNewTouch = explicitTouch || externalReferrer;
  const current = {
    source: params.get("utm_source") || (externalReferrer ? "referral" : "direct"),
    medium: params.get("utm_medium") || (externalReferrer ? "referral" : "none"),
    campaign: params.get("utm_campaign") || "",
    referrer: document.referrer || "",
    landingPage: pathname || "/",
    referralSource: params.get("ref") || params.get("referral") || "",
  };
  const existingRaw = readCookie(ATTRIBUTION_COOKIE);
  let existing: Record<string, string> = {};
  try { existing = existingRaw ? JSON.parse(existingRaw) as Record<string, string> : {}; } catch { existing = {}; }
  const lastSource = hasNewTouch ? current.source : existing.lastSource || existing.source || current.source;
  const lastMedium = hasNewTouch ? current.medium : existing.lastMedium || existing.medium || current.medium;
  const lastCampaign = hasNewTouch ? current.campaign : existing.lastCampaign || existing.campaign || "";
  const lastReferrer = hasNewTouch ? current.referrer : existing.lastReferrer || existing.referrer || "";
  const lastLandingPage = hasNewTouch ? current.landingPage : existing.lastLandingPage || existing.landingPage || current.landingPage;
  const next = {
    firstSource: existing.firstSource || current.source,
    firstMedium: existing.firstMedium || current.medium,
    firstCampaign: existing.firstCampaign || current.campaign,
    firstReferrer: existing.firstReferrer || current.referrer,
    firstLandingPage: existing.firstLandingPage || current.landingPage,
    lastSource,
    lastMedium,
    lastCampaign,
    lastReferrer,
    lastLandingPage,
    // Keep the legacy keys for older clients and server readers.
    source: lastSource,
    medium: lastMedium,
    campaign: lastCampaign,
    referrer: lastReferrer,
    landingPage: lastLandingPage,
    referralSource: current.referralSource || existing.referralSource || "",
  };
  writeCookie(ATTRIBUTION_COOKIE, JSON.stringify(next), 60 * 60 * 24 * 90);
  return current;
}

/**
 * Fires a lightweight POST /api/track to the backend every time
 * the Next.js route changes, giving the admin dashboard real visitor data.
 * Only tracks non-admin routes.
 */
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Don't track admin visits
    if (pathname?.startsWith("/admin")) return;

    const anonymousId = ensureIdentityCookie(ANONYMOUS_COOKIE);
    const sessionId = ensureIdentityCookie(SESSION_COOKIE);
    const attribution = updateAttribution(pathname || "/");
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || "",
        anonymousId,
        sessionId,
        ...attribution,
      }),
    }).catch(() => {
      // Silently fail — tracking should never break the user experience
    });
  }, [pathname]);

  return null;
}
