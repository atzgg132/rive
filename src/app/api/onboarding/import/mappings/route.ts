import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

const PROVIDER = /^[a-z0-9_-]{2,40}$/;
const ENTITY = new Set(["clients", "projects", "invoices", "expenses", "payments", "tasks"]);

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const provider = req.nextUrl.searchParams.get("provider");
  const mappings = await prisma.importMapping.findMany({
    where: {
      userId: session.userId,
      active: true,
      ...(provider && PROVIDER.test(provider) ? { provider } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ success: true, mappings });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const provider = typeof body?.provider === "string" ? body.provider.trim().toLowerCase() : "";
  const entity = typeof body?.entity === "string" ? body.entity.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const mapping = body?.mapping;
  if (!PROVIDER.test(provider) || !ENTITY.has(entity) || !name || !mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    return NextResponse.json({ success: false, message: "A valid provider, entity, name, and field mapping are required." }, { status: 400 });
  }
  const entries = Object.entries(mapping as Record<string, unknown>);
  if (entries.length > 100 || entries.some(([source, target]) => source.length > 120 || typeof target !== "string" || target.length > 120)) {
    return NextResponse.json({ success: false, message: "The field mapping is too large or contains invalid fields." }, { status: 400 });
  }
  const saved = await prisma.importMapping.upsert({
    where: { userId_provider_entity_name: { userId: session.userId, provider, entity, name } },
    update: { mapping, active: true },
    create: { userId: session.userId, provider, entity, name, mapping },
  });
  return NextResponse.json({ success: true, mapping: saved });
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, message: "Mapping ID is required." }, { status: 400 });
  const retired = await prisma.importMapping.updateMany({ where: { id, userId: session.userId, active: true }, data: { active: false } });
  if (!retired.count) return NextResponse.json({ success: false, message: "Mapping not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
