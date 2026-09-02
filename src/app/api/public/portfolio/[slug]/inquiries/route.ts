import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { buildPortfolioInquiryEmail } from "@/utils/email";
import { enqueueEmail } from "@/utils/emailOutbox";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimitResult } from "@/utils/durableRateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { getPublicPortfolioContent, isPortfolioPublished, mergePortfolioContent } from "@/utils/portfolio";
import { buildPortfolioVisitorHash, deviceFromUserAgent, normalizePortfolioReferrer } from "@/utils/portfolioAnalytics";
import {
  INQUIRY_RATE_LIMITS,
  inquiryPayloadFingerprint,
  inquiryRateLimitKey,
  MAX_INQUIRY_BODY_BYTES,
  validateInquirySubmission,
  type InquiryRateLimitScope,
} from "@/utils/portfolioInquiries";

/**
 * Public portfolio enquiry submission.
 *
 * The enquiry is the deliverable. It used to exist only as an outbound email,
 * so an unavailable mail provider returned 503 and the lead was gone — the
 * visitor had no way to know their message was never stored, because it never
 * was. Now the record is committed and the notification is queued in a single
 * transaction, and the response says "received" only once that has happened.
 *
 * Nothing here waits on SMTP or SES. Delivery is the outbox worker's problem,
 * and its outcome is written back onto the enquiry.
 */

type RouteContext = { params: Promise<{ slug: string }> };

/** One shape for every refusal that must not describe what it refused. */
function throttled(retryAfterSeconds: number | null) {
  return NextResponse.json(
    { success: false, message: "You’ve sent several enquiries. Please try again later." },
    {
      status: 429,
      headers: retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined,
    },
  );
}

async function checkLimit(scope: InquiryRateLimitScope, ...parts: string[]) {
  const { limit, windowMs } = INQUIRY_RATE_LIMITS[scope];
  return durableRateLimitResult(inquiryRateLimitKey(scope, ...parts), limit, windowMs);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;

  /* Size first, before the body is touched. A caller that announces megabytes
     is refused without allocating any of them, and a caller that lies about
     Content-Length is caught by the byte check below. */
  const declaredLength = Number.parseInt(request.headers.get("content-length") || "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_INQUIRY_BODY_BYTES) {
    return NextResponse.json({ success: false, message: "That message is too large." }, { status: 413 });
  }

  const ip = getRequestIp(request);
  const visitorKey = hashRequestValue(ip);

  /* Layered, durable, and race-safe. Each window is counted in Postgres, so the
     caps hold across restarts and across instances, and two concurrent requests
     cannot both pass a cap. Checked before the body is parsed so a flood costs
     the sender their quota rather than costing us the work.

     Every 429 below is byte-identical, and all of these run before the portfolio
     is looked up, so a throttled response never reveals whether the slug or its
     recipient exists. */
  const global = await checkLimit("global");
  if (!global.allowed) return throttled(global.retryAfterSeconds);

  const perPortfolio = await checkLimit("portfolio", slug);
  if (!perPortfolio.allowed) return throttled(perPortfolio.retryAfterSeconds);

  const perVisitor = await checkLimit("visitor", slug, visitorKey);
  if (!perVisitor.allowed) return throttled(perVisitor.retryAfterSeconds);

  const raw = await request.text().catch(() => null);
  if (raw === null) {
    return NextResponse.json({ success: false, message: "Please complete every field with valid details." }, { status: 400 });
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_INQUIRY_BODY_BYTES) {
    return NextResponse.json({ success: false, message: "That message is too large." }, { status: 413 });
  }

  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ success: false, message: "Please complete every field with valid details." }, { status: 400 });
  }

  const validation = validateInquirySubmission(body);
  // A honeypot hit is thanked and dropped. No record, no mail, no hint that the
  // field is what gave it away.
  if (!validation.ok && validation.reason === "honeypot") return NextResponse.json({ success: true });
  if (!validation.ok) {
    return NextResponse.json(
      { success: false, message: "Please complete every field with valid details." },
      { status: 400 },
    );
  }

  const submission = validation.value;

  const perSender = await checkLimit("sender", slug, hashRequestValue(submission.email));
  if (!perSender.allowed) return throttled(perSender.retryAfterSeconds);

  const fingerprint = await checkLimit(
    "fingerprint",
    hashRequestValue(inquiryPayloadFingerprint({
      slug,
      projectType: submission.projectType,
      message: submission.message,
    })),
  );
  if (!fingerprint.allowed) return throttled(fingerprint.retryAfterSeconds);

  try {
    const portfolio = await prisma.portfolio.findUnique({
      where: { slug },
      select: { id: true, userId: true, status: true, content: true },
    });
    if (!portfolio || !isPortfolioPublished(portfolio.status)) {
      return NextResponse.json({ success: false, message: "This portfolio is not available." }, { status: 404 });
    }

    const content = mergePortfolioContent(portfolio.content);
    if (!content.contactEmail) {
      return NextResponse.json(
        { success: false, message: "This portfolio is not accepting enquiries yet." },
        { status: 409 },
      );
    }

    /* Attribution is only kept when it resolves to a project the visitor could
       actually have been reading. An unknown identifier is recorded as no
       source rather than as a project that does not exist. */
    const publicProjects = getPublicPortfolioContent(portfolio.content).projects;
    const sourceProject = submission.sourceProjectId
      ? publicProjects.find((project) => project.id === submission.sourceProjectId) ?? null
      : null;

    const userAgent = request.headers.get("user-agent") || "";
    const notification = buildPortfolioInquiryEmail({
      to: content.contactEmail,
      portfolioName: content.name,
      visitorName: submission.name,
      visitorEmail: submission.email,
      projectType: submission.projectType,
      message: submission.message,
      sourceProjectTitle: sourceProject?.title ?? null,
    });

    /* One transaction: the enquiry and its queued notification commit together
       or not at all. There is no window in which a lead exists with no pending
       notification, or a notification exists with no lead behind it. */
    const inquiry = await prisma.$transaction(async (tx) => {
      const outboxId = await enqueueEmail(notification, tx);
      return tx.portfolioInquiry.create({
        data: {
          portfolioId: portfolio.id,
          userId: portfolio.userId,
          sourceProjectId: sourceProject?.id ?? null,
          sourceProjectTitle: sourceProject?.title?.trim() || null,
          name: submission.name,
          email: submission.email,
          projectType: submission.projectType,
          message: submission.message,
          attributionSource: submission.attribution.source,
          attributionMedium: submission.attribution.medium,
          attributionCampaign: submission.attribution.campaign,
          attributionLandingPage: submission.attribution.landingPage,
          attributionReferral: submission.attribution.referral,
          outboxId,
          // Salted, per-day, one-way. The raw address is never stored.
          visitorHash: buildPortfolioVisitorHash({ ip, userAgent }),
          referrer: normalizePortfolioReferrer(request.headers.get("referer")),
          deviceType: deviceFromUserAgent(userAgent),
        },
        select: { id: true },
      });
    });

    // Persisted and queued. Delivery happens on the worker's schedule.
    return NextResponse.json({ success: true, inquiryId: inquiry.id }, { status: 201 });
  } catch (error) {
    console.error("Portfolio inquiry error:", error);
    return NextResponse.json(
      { success: false, message: "Your enquiry could not be saved. Please try again shortly." },
      { status: 500 },
    );
  }
}
