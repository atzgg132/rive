"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sanitizeAnalyticsPath, sanitizeAnalyticsReferrer } from "@/lib/route-privacy";

const ANONYMOUS_COOKIE = "rive_anonymous_id";
const SESSION_COOKIE = "rive_analytics_session";
const ATTRIBUTION_COOKIE = "rive_attribution";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1] || "") : null;
}

function writeSessionCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}`;
}

function ensureSessionIdentityCookie(name: string): string {
  const current = readCookie(name);
  if (current) {
    writeSessionCookie(name, current);
    return current;
  }
  const value = crypto.randomUUID();
  writeSessionCookie(name, value);
  return value;
}

function updateAttribution(pathname: string, safeReferrer: string): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const explicitTouch = ["utm_source", "utm_medium", "utm_campaign", "ref", "referral"].some((key) => Boolean(params.get(key)));
  let externalReferrer = false;
  try {
    externalReferrer = Boolean(safeReferrer) && new URL(safeReferrer).hostname !== window.location.hostname;
  } catch {
    externalReferrer = false;
  }
  const hasNewTouch = explicitTouch || externalReferrer;
  const current = {
    source: params.get("utm_source") || (externalReferrer ? "referral" : "direct"),
    medium: params.get("utm_medium") || (externalReferrer ? "referral" : "none"),
    campaign: params.get("utm_campaign") || "",
    referrer: safeReferrer,
    landingPage: pathname || "/",
    referralSource: params.get("ref") || params.get("referral") || "",
  };
  const existingRaw = readCookie(ATTRIBUTION_COOKIE);
  let existing: Record<string, string> = {};
  try { existing = existingRaw ? JSON.parse(existingRaw) as Record<string, string> : {}; } catch { existing = {}; }
  const safeExistingPath = (value: unknown) => typeof value === "string" && value
    ? sanitizeAnalyticsPath(value)
    : "";
  const safeExistingReferrer = (value: unknown) => typeof value === "string" && value
    ? sanitizeAnalyticsReferrer(value) || ""
    : "";
  const lastSource = hasNewTouch ? current.source : existing.lastSource || existing.source || current.source;
  const lastMedium = hasNewTouch ? current.medium : existing.lastMedium || existing.medium || current.medium;
  const lastCampaign = hasNewTouch ? current.campaign : existing.lastCampaign || existing.campaign || "";
  const lastReferrer = hasNewTouch ? current.referrer : safeExistingReferrer(existing.lastReferrer) || safeExistingReferrer(existing.referrer) || "";
  const lastLandingPage = hasNewTouch ? current.landingPage : safeExistingPath(existing.lastLandingPage) || safeExistingPath(existing.landingPage) || current.landingPage;
  const next = {
    firstSource: existing.firstSource || current.source,
    firstMedium: existing.firstMedium || current.medium,
    firstCampaign: existing.firstCampaign || current.campaign,
    firstReferrer: safeExistingReferrer(existing.firstReferrer) || current.referrer,
    firstLandingPage: safeExistingPath(existing.firstLandingPage) || current.landingPage,
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
  writeSessionCookie(ATTRIBUTION_COOKIE, JSON.stringify(next));
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

    const anonymousId = ensureSessionIdentityCookie(ANONYMOUS_COOKIE);
    const sessionId = ensureSessionIdentityCookie(SESSION_COOKIE);
    const safePathname = sanitizeAnalyticsPath(pathname || "/");
    const safeReferrer = sanitizeAnalyticsReferrer(document.referrer) || "";
    const attribution = updateAttribution(safePathname, safeReferrer);
    const authView = new URLSearchParams(window.location.search).get("auth");
    const trackedPath = sanitizeAnalyticsPath(authView === "register" ? "/register" : pathname || "/");
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: trackedPath,
        referrer: safeReferrer,
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
