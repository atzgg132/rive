import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { revokeAdminSession } from "@/utils/adminSession";
import { prisma } from "@/utils/db";
import { getRequestIp } from "@/utils/rateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { logger, requestLogContext } from "@/utils/logger";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  await revokeAdminSession(req, response);
  await prisma.auditEvent.create({ data: { action: "admin.logout", targetType: "admin_session", ipHash: hashRequestValue(getRequestIp(req)) } })
    .catch((error) => logger.warn("admin_audit_write_failed", { ...requestLogContext(req), error }));
  return response;
}
