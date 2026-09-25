import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { findValidAuthToken } from "@/utils/authTokens";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { logger, requestLogContext } from "@/utils/logger";

export const dynamic = "force-dynamic";

const appUrl = (process.env.APP_URL || "https://www.rive.work").replace(/\/$/, "");

function confirmationPage(message: string, form?: { action: string }): string {
  const action = form
    ? `<form method="post" action="${form.action}" style="margin:0 0 12px"><button type="submit" style="padding:12px 20px;background:#181511;color:#F7F5ED;border:0;font-weight:700;font-size:14px;cursor:pointer">Turn off weekly summaries</button></form>`
    : "";
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>rive.</title></head>
<body style="margin:0;background:#F7F5ED;color:#181511;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:480px;margin:80px auto;padding:32px;border:2px solid #181511;background:#FDFCF7;text-align:center">
    <p style="font-size:24px;font-weight:800;margin:0 0 16px">rive<span style="color:#1D4ED8">.</span></p>
    <p style="font-size:15px;line-height:24px;color:#55503F;margin:0 0 20px">${message}</p>
    ${action}
    <a href="${appUrl}/settings" style="color:#181511;font-size:14px">Manage notification settings</a>
  </div>
</body>
</html>`;
}

function htmlResponse(status: number, message: string, form?: { action: string }): NextResponse {
  return new NextResponse(confirmationPage(message, form), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

const INVALID_LINK = "This unsubscribe link has expired or was already used. You can turn off weekly summaries from Settings instead.";

/**
 * Unsubscribe from the weekly summary email. Public and token-gated like the
 * other `api/public/*` routes, so the link works straight from an email
 * client. GET only shows a confirmation; the POST it submits turns the
 * summary off. Mail scanners fetch every link in a message, so a GET that
 * unsubscribed would turn summaries off without the owner asking.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const authToken = await findValidAuthToken(token, "weekly_summary_unsubscribe").catch(() => null);
  if (!authToken || !authToken.userId) return htmlResponse(400, INVALID_LINK);
  return htmlResponse(200, "Turn off the weekly summary email for your account?", {
    action: `${url.pathname}?token=${encodeURIComponent(token)}`,
  });
}

export async function POST(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const context = requestLogContext(req);
  try {
    const authToken = await findValidAuthToken(token, "weekly_summary_unsubscribe");
    if (!authToken || !authToken.userId) return htmlResponse(400, INVALID_LINK);

    await prisma.$transaction([
      prisma.user.update({ where: { id: authToken.userId }, data: { weeklySummaryEnabled: false } }),
      prisma.authToken.update({ where: { id: authToken.id }, data: { usedAt: new Date() } }),
    ]);
    await recordProductEvent({ userId: authToken.userId, eventName: PRODUCT_EVENTS.weeklySummaryDisabled, module: "weekly_summary", source: "email_unsubscribe" });

    return htmlResponse(200, "You’re unsubscribed. Weekly summary emails are now turned off for your account.");
  } catch (error) {
    logger.error("weekly_summary_unsubscribe_failed", { ...context, error });
    return htmlResponse(500, "Something went wrong processing this link. Please try again, or turn off weekly summaries from Settings.");
  }
}
