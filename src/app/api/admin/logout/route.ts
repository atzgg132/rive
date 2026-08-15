import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { revokeAdminSession } from "@/utils/adminSession";
import { prisma } from "@/utils/db";
import { getRequestIp } from "@/utils/rateLimit";
import { hashRequestValue } from "@/utils/contracts";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  await revokeAdminSession(req, response);
  await prisma.auditEvent.create({ data: { action: "admin.logout", targetType: "admin_session", ipHash: hashRequestValue(getRequestIp(req)) } }).catch((error) => console.warn("Admin access audit failed:", error));
  return response;
}
