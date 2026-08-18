import "server-only";

import { prisma } from "@/utils/db";
import { getRequestIpFromHeaders } from "@/utils/rateLimit";
import { verifyUserToken, TOKEN_COOKIE_NAME } from "@/utils/userAuth";
import {
  buildPortfolioVisitorHash,
  deviceFromUserAgent,
  isKnownBotUserAgent,
  normalizePortfolioReferrer,
  PORTFOLIO_VIEW_DEDUP_WINDOW_MS,
  type PortfolioViewPageType,
} from "@/utils/portfolioAnalytics";

/**
 * The single place a portfolio view is recorded.
 *
 * This used to be four near-identical copies — the landing page, a practice
 * page, a case study, and the public JSON route — which is how they drifted
 * apart: the case study blocked the response on its insert, and none of them
 * agreed on what a tablet was. Attribution, exclusion, and de-duplication rules
 * now have one home, so "views" means the same thing wherever it is counted.
 */

export type PortfolioViewSkipReason = "bot" | "preview" | "owner" | "duplicate" | "error";

export type RecordPortfolioViewInput = {
  portfolioId: string;
  /** Used only to drop the owner's own traffic; never stored on the view. */
  ownerUserId: string;
  pageType: PortfolioViewPageType;
  /** Portfolio JSON project identifier for a case study. */
  projectId?: string | null;
  ip: string;
  userAgent: string;
  referrer: string | null;
  /** Raw session cookie value, when the request carried one. */
  sessionToken?: string | null;
  /** An explicit editor/preview render, which is never public interest. */
  preview?: boolean;
  at?: Date;
};

export type PortfolioViewRequestContext = {
  ip: string;
  userAgent: string;
  referrer: string | null;
  sessionToken: string | null;
  preview: boolean;
};

const PREVIEW_HEADER = "x-rive-portfolio-preview";

/**
 * Reads everything the recorder needs from request headers.
 *
 * Server Components must read request data during render — `headers()` inside
 * an `after` callback throws — so call sites gather this first and hand the
 * plain values to `recordPortfolioView` afterwards.
 */
export function portfolioViewRequestContext(
  requestHeaders: Headers,
  options: { previewSearchParam?: string | null } = {},
): PortfolioViewRequestContext {
  const userAgent = requestHeaders.get("user-agent") || "";
  const cookieHeader = requestHeaders.get("cookie") || "";
  const sessionMatch = cookieHeader.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE_NAME}=([^;]*)`));
  return {
    /* Shared with the rate limiters rather than reading the leftmost
       X-Forwarded-For entry, which is whatever the caller typed: that would let
       anyone inflate their own unique-visitor figures by varying one header. */
    ip: getRequestIpFromHeaders(requestHeaders),
    userAgent,
    referrer: normalizePortfolioReferrer(requestHeaders.get("referer")),
    sessionToken: sessionMatch ? decodeURIComponent(sessionMatch[1]) : null,
    preview:
      requestHeaders.get(PREVIEW_HEADER) === "1" ||
      options.previewSearchParam === "1" ||
      options.previewSearchParam === "true",
  };
}

/**
 * Records one public view, or explains why it was not recorded.
 *
 * Never throws. Analytics is a side effect of serving a portfolio; a failure to
 * count a visit must not turn into a failure to show someone's work.
 */
export async function recordPortfolioView(
  input: RecordPortfolioViewInput,
): Promise<{ recorded: boolean; reason?: PortfolioViewSkipReason }> {
  if (input.preview) return { recorded: false, reason: "preview" };
  if (isKnownBotUserAgent(input.userAgent)) return { recorded: false, reason: "bot" };

  // The owner reading their own portfolio — including through the studio's
  // "View live site" link — is editorial traffic, not audience interest.
  const session = verifyUserToken(input.sessionToken || null);
  if (session?.userId === input.ownerUserId) return { recorded: false, reason: "owner" };

  const at = input.at ?? new Date();
  const visitorHash = buildPortfolioVisitorHash({ ip: input.ip, userAgent: input.userAgent, at });
  const projectId = input.pageType === "project" ? input.projectId || null : null;

  try {
    /* Bounded de-duplication. A rapid reload, a back-navigation, and the public
       JSON read that can follow a page render all resolve to the same visitor
       on the same page, so only the first is counted. Served by the existing
       (portfolio_id, visitor_hash, viewed_at) index. Best-effort by nature:
       two truly simultaneous requests can both miss the check, which is a far
       better failure than double-counting every reload. */
    const recent = await prisma.portfolioView.findFirst({
      where: {
        portfolioId: input.portfolioId,
        visitorHash,
        pageType: input.pageType,
        projectId,
        viewedAt: { gte: new Date(at.getTime() - PORTFOLIO_VIEW_DEDUP_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recent) return { recorded: false, reason: "duplicate" };

    await prisma.portfolioView.create({
      data: {
        portfolioId: input.portfolioId,
        pageType: input.pageType,
        projectId,
        visitorHash,
        referrer: input.referrer,
        deviceType: deviceFromUserAgent(input.userAgent),
        viewedAt: at,
      },
    });
    return { recorded: true };
  } catch (error) {
    console.error("Portfolio view recording failed:", error);
    return { recorded: false, reason: "error" };
  }
}
