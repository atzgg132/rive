import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { findValidAuthToken } from "@/utils/authTokens";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { logger, requestLogContext } from "@/utils/logger";

export const dynamic = "force-dynamic";

const appUrl = (process.env.APP_URL || "https://www.rive.work").replace(/\/$/, "");

function confirmationPage(message: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>rive.</title></head>
<body style="margin:0;background:#F7F5ED;color:#181511;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:480px;margin:80px auto;padding:32px;border:2px solid #181511;background:#FDFCF7;text-align:center">
    <p style="font-size:24px;font-weight:800;margin:0 0 16px">rive<span style="color:#1D4ED8">.</span></p>
    <p style="font-size:15px;line-height:24px;color:#55503F;margin:0 0 20px">${message}</p>
    <a href="${appUrl}/settings" style="display:inline-block;padding:12px 20px;background:#181511;color:#F7F5ED;text-decoration:none;font-weight:700;font-size:14px">Manage notification settings</a>
  </div>
</body>
</html>`;
}

function htmlResponse(status: number, message: string): NextResponse {
  return new NextResponse(confirmationPage(message), { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * One-click unsubscribe from the weekly summary email. Public and
 * token-gated like the other `api/public/*` routes — no session required, so
 * the link works straight from an email client.
 */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const context = requestLogContext(req);
  try {
    const authToken = await findValidAuthToken(token, "weekly_summary_unsubscribe");
    if (!authToken || !authToken.userId) {
      return htmlResponse(400, "This unsubscribe link has expired or was already used. You can turn off weekly summaries from Settings instead.");
    }

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
