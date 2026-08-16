import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/utils/adminSession";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authenticated = await hasAdminSession(req);
  return NextResponse.json(
    { success: authenticated },
    {
      status: authenticated ? 200 : 401,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
