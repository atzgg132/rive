import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { hasAdminSession } from "@/utils/adminSession";

const STATUSES = new Set(["new", "reviewing", "planned", "closed"]);

export async function GET(req: NextRequest) {
  if (!await hasAdminSession(req)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const page = Math.max(Number.parseInt(params.get("page") || "1", 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(params.get("pageSize") || "25", 10) || 25, 1), 50);
  const status = params.get("status") || "all";
  const where = status !== "all" ? { status } : {};
  const [total, data] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { user: { select: { email: true, name: true } } } }),
  ]);
  return NextResponse.json({ success: true, page, pageSize, total, data });
}

export async function PATCH(req: NextRequest) {
  if (!await hasAdminSession(req)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const body = await req.json().catch(() => null) as { id?: unknown; status?: unknown; tags?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const tags = Array.isArray(body?.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 20) : undefined;
  if (!id || !STATUSES.has(status)) return NextResponse.json({ success: false, message: "Invalid feedback update." }, { status: 400 });
  const feedback = await prisma.feedback.update({ where: { id }, data: { status, ...(tags ? { tags } : {}) } });
  return NextResponse.json({ success: true, feedback });
}
