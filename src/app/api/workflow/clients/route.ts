import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { buildPagination, paginationOffset, parsePagination } from "@/lib/pagination";

// GET /api/workflow/clients
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const mode = searchParams.get("mode") || "list";

    // Build Prisma query filters
    const where: Prisma.ClientWhereInput = {
      userId: session.userId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } }
      ];
    }

    if (status !== "all") {
      where.status = status;
    }

    if (mode === "options") {
      const optionLimit = parsePagination(searchParams, { pageSize: 100, maxPageSize: 100 }).pageSize;
      const [optionTotal, options] = await Promise.all([
        prisma.client.count({ where }),
        prisma.client.findMany({
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: optionLimit,
          select: { id: true, name: true, email: true, company: true, address: true, status: true },
        }),
      ]);

      return NextResponse.json({
        success: true,
        clients: options,
        options: { limit: optionLimit, total: optionTotal, hasMore: optionTotal > optionLimit },
      });
    }

    const requestedPagination = parsePagination(searchParams);
    const total = await prisma.client.count({ where });
    const pagination = buildPagination(total, requestedPagination);
    const clients = await prisma.client.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: paginationOffset(pagination),
      take: pagination.pageSize,
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        website: true,
        address: true,
        avatarColor: true,
        notes: true,
        tags: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const clientIds = clients.map((client) => client.id);
    const [projectCounts, contractCounts, paidRevenue] = clientIds.length ? await Promise.all([
      prisma.project.groupBy({
        by: ["clientId"],
        where: { userId: session.userId, clientId: { in: clientIds }, status: { not: "archived" } },
        _count: { _all: true },
      }),
      prisma.contract.groupBy({
        by: ["clientId"],
        where: { userId: session.userId, clientId: { in: clientIds } },
        _count: { _all: true },
      }),
      prisma.invoice.groupBy({
        by: ["clientId", "currency"],
        where: { userId: session.userId, clientId: { in: clientIds }, status: "paid" },
        _sum: { total: true },
      }),
    ]) : [[], [], []];

    const projectCountByClient = new Map(projectCounts.map((row) => [row.clientId, row._count._all]));
    const contractCountByClient = new Map(contractCounts.map((row) => [row.clientId, row._count._all]));
    const revenueByClient = new Map<string, { total: number; byCurrency: Record<string, number> }>();
    for (const row of paidRevenue) {
      if (!row.clientId) continue;
      const current = revenueByClient.get(row.clientId) || { total: 0, byCurrency: {} };
      const amount = Number(row._sum.total || 0);
      current.total += amount;
      current.byCurrency[row.currency] = (current.byCurrency[row.currency] || 0) + amount;
      revenueByClient.set(row.clientId, current);
    }

    const formattedClients = clients.map((c) => {
      const revenue = revenueByClient.get(c.id) || { total: 0, byCurrency: {} };
      
      return {
        id: c.id,
        user_id: c.userId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        website: c.website,
        address: c.address,
        avatar_color: c.avatarColor,
        notes: c.notes,
        tags: c.tags,
        status: c.status,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
        project_count: projectCountByClient.get(c.id) || 0,
        total_revenue: revenue.total,
        revenue_by_currency: revenue.byCurrency,
        contract_count: contractCountByClient.get(c.id) || 0,
      };
    });

    return NextResponse.json({
      success: true,
      clients: formattedClients,
      pagination,
    });
  } catch (error: unknown) {
    console.error("Clients fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// POST /api/workflow/clients
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { name, email, phone, company, website, address, notes, tags } = await req.json();
    if (!name) {
      return NextResponse.json({ success: false, message: "Client name is required." }, { status: 400 });
    }

    // Pick random colors for avatar
    const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const client = await prisma.client.create({
      data: {
        userId: session.userId,
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        website: website || null,
        address: address || null,
        avatarColor,
        notes: notes || null,
        tags: tags || [],
        status: "active",
        dataOrigin: "user"
      }
    });
    await Promise.all([
      recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstClientCreated, { clientId: client.id }),
      recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.clientCreated, module: "clients", entityType: "client", entityId: client.id, dataOrigin: "user" }),
    ]);

    // Formatting for frontend compatibility
    const formattedClient = {
      ...client,
      user_id: client.userId,
      avatar_color: client.avatarColor,
      created_at: client.createdAt,
      updated_at: client.updatedAt
    };

    return NextResponse.json({
      success: true,
      message: "Client created successfully.",
      client: formattedClient
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("Client create error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// PUT /api/workflow/clients
export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id, name, email, phone, company, website, address, notes, tags } = await req.json();
    if (!id || !name) {
      return NextResponse.json({ success: false, message: "Client ID and name are required." }, { status: 400 });
    }

    const existing = await prisma.client.findFirst({ where: { id, userId: session.userId } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Client not found." }, { status: 404 });
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        website: website || null,
        address: address || null,
        notes: notes || null,
        tags: tags || []
      }
    });

    return NextResponse.json({ success: true, message: "Client updated successfully.", client });
  } catch (error: unknown) {
    console.error("Client update error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// DELETE /api/workflow/clients
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ success: false, message: "Client ID is required." }, { status: 400 });
    }

    const existing = await prisma.client.findFirst({ where: { id, userId: session.userId } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Client not found." }, { status: 404 });
    }

    const contractCount = await prisma.contract.count({ where: { clientId: id } });
    if (contractCount > 0) {
      return NextResponse.json({ success: false, message: "This client has contract records. Archive the client instead of deleting it so signer and evidence history remains intact." }, { status: 409 });
    }

    await prisma.client.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Client deleted successfully." });
  } catch (error: unknown) {
    console.error("Client delete error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
