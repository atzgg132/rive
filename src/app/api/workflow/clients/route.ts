import { NextRequest, NextResponse } from "next/server";
import { getDbPool, initDbSchema } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

// GET /api/workflow/clients
export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const pool = getDbPool();
    await initDbSchema(pool);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";

    const conditions = ["user_id = $1"];
    const params: any[] = [session.userId];

    let paramIdx = 2;
    if (search) {
      conditions.push(`(name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR company ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (status !== "all") {
      conditions.push(`status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const whereClause = conditions.join(" AND ");
    
    // Select clients and calculate their total projects and invoice revenues
    const query = `
      SELECT c.*, 
        COUNT(DISTINCT p.id)::int AS project_count,
        COALESCE(SUM(DISTINCT i.total), 0)::numeric AS total_revenue
      FROM clients c
      LEFT JOIN projects p ON p.client_id = c.id AND p.status != 'archived'
      LEFT JOIN invoices i ON i.client_id = c.id AND i.status = 'paid'
      WHERE ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC;
    `;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      clients: result.rows
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

    const pool = getDbPool();
    await initDbSchema(pool);

    // Pick a random soft colors for avatar
    const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const result = await pool.query(
      `INSERT INTO clients (user_id, name, email, phone, company, website, address, avatar_color, notes, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *;`,
      [session.userId, name, email || null, phone || null, company || null, website || null, address || null, avatarColor, notes || null, tags || []]
    );

    return NextResponse.json({
      success: true,
      message: "Client created successfully.",
      client: result.rows[0]
    }, { status: 201 });
  } catch (error: any) {
    console.error("Client create error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
