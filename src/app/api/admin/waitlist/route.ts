import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { verifyToken } from "@/utils/auth";
import { getWaitlistOperationalDetails } from "@/utils/waitlistAdmin";

const SORT_FIELDS = {
  email: "email",
  type: "type",
  status: "status",
  created_at: "createdAt",
  createdAt: "createdAt",
} as const;

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (!verifyToken(token)) {
    return NextResponse.json({ success: false, message: "unauthorised." }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const page   = positiveInteger(searchParams.get("page"), 1);
    const limit  = Math.min(100, positiveInteger(searchParams.get("limit"), 20));
    const offset = (page - 1) * limit;
    const search = (searchParams.get("search") || "").trim().slice(0, 254);
    const status = searchParams.get("status") || "all";
    const type   = searchParams.get("type")   || "all";
    const requestedSort = searchParams.get("sort") || "createdAt";
    const sort = requestedSort in SORT_FIELDS
      ? SORT_FIELDS[requestedSort as keyof typeof SORT_FIELDS]
      : "createdAt";
    const order = searchParams.get("order")?.toLowerCase() === "asc" ? "asc" : "desc";

    // Build filter query object
    const where: Prisma.WaitlistWhereInput = {};
    if (search) {
      where.email = { contains: search, mode: "insensitive" };
    }
    if (status === "pending" || status === "approved") {
      where.status = status;
    }
    if (["waitlist", "remit", "login", "demo"].includes(type)) {
      where.type = type;
    }

    const [total, data] = await Promise.all([
      prisma.waitlist.count({ where }),
      prisma.waitlist.findMany({
        where,
        orderBy: {
          [sort]: order,
        },
        skip: offset,
        take: limit,
      }),
    ]);

    const operationalDetails = await getWaitlistOperationalDetails(data.map((item) => item.email));
    const formattedData = data.map((item) => {
      const details = operationalDetails.get(item.email.toLowerCase());
      const registered = details?.registered || false;
      return {
        ...item,
        created_at: item.createdAt,
        registered,
        registered_at: details?.registeredAt || null,
        invite_status: registered
          ? "registered"
          : item.status === "pending"
            ? "not_sent"
            : details?.inviteStatus || "not_sent",
        invite_expires_at: details?.inviteExpiresAt || null,
        latest_delivery_status: details?.latestDeliveryStatus || null,
        latest_delivery_at: details?.latestDeliveryAt || null,
      };
    });

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
    }, { status: 500 });
  }
}
