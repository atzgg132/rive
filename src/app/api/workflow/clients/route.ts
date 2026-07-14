import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

// GET /api/workflow/clients
export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";

    // Build Prisma query filters
    const where: any = {
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

    // Load clients including aggregations
    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        projects: {
          where: { status: { not: "archived" } },
          select: { id: true }
        },
        invoices: {
          where: { status: "paid" },
          select: { total: true }
        }
      }
    });

    // Format output to match client requirements (including counts and sums)
    const formattedClients = clients.map((c: any) => {
      const project_count = c.projects.length;
      const total_revenue = c.invoices.reduce((sum: number, inv: any) => sum + Number(inv.total), 0);
      
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
        project_count,
        total_revenue
      };
    });

    return NextResponse.json({
      success: true,
      clients: formattedClients
    });
  } catch (error: any) {
    console.error("Clients fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// POST /api/workflow/clients
export async function POST(req: NextRequest) {
  try {
    const session = getSessionUser(req);
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
        status: "active"
      }
    });

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
  } catch (error: any) {
    console.error("Client create error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
