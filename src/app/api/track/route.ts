import { NextRequest, NextResponse } from "next/server";
import { getDbPool, initDbSchema } from "@/utils/db";

export async function POST(req: NextRequest) {
  try {
    const { path, referrer } = await req.json();
    const userAgent = req.headers.get("user-agent") || "";
    
    const pool = getDbPool();
    await initDbSchema(pool); // Lazy initialize tables if first request

    await pool.query(
      "INSERT INTO page_views (path, referrer, user_agent) VALUES ($1, $2, $3);",
      [path || "/", referrer || "", userAgent]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    // Return success to client so tracking never blocks page load
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
