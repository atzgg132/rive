import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { verifyToken } from "@/utils/auth";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (!verifyToken(token)) {
    return NextResponse.json({ success: false, message: "unauthorised." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get("page")  || "1", 10));
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const type   = searchParams.get("type")   || "all";
    const sort   = searchParams.get("sort")   || "createdAt";
    const order  = (searchParams.get("order") || "DESC").toLowerCase() as "asc" | "desc";

    // Build filter query object
  const where: Prisma.WaitlistWhereInput = {};
    if (search) {
      where.email = { contains: search, mode: "insensitive" };
    }
    if (status !== "all") {
      where.status = status;
    }
    if (type !== "all") {
      where.type = type;
    }

    // Map legacy column names if requested
    let orderByField = sort;
    if (sort === "created_at") orderByField = "createdAt";

    const [total, data] = await Promise.all([
      prisma.waitlist.count({ where }),
      prisma.waitlist.findMany({
        where,
        orderBy: {
          [orderByField]: order
        },
        skip: offset,
        take: limit
      })
    ]);

    const formattedData = data.map(item => ({
      ...item,
      created_at: item.createdAt
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
      total,
      page,
      limit
    });
  } catch (error: unknown) {
    console.error("Waitlist fetch error:", error);
    return NextResponse.json({
      success: false,
      message: "Internal server error.",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack || "" : ""
    }, { status: 500 });
  }
}
