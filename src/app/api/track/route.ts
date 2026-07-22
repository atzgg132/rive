import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";

export async function POST(req: NextRequest) {
  try {
    const { path, referrer } = await req.json();
    const userAgent = req.headers.get("user-agent") || "";
    
    await prisma.pageView.create({
      data: {
        path: path || "/",
        referrer: referrer || null,
        userAgent: userAgent || null
      }
    });

    return NextResponse.json({ success: true });
  } catch {
    // Return success to client so tracking never blocks page load
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
