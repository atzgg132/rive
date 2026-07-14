import { NextRequest, NextResponse } from "next/server";
import { getDbPool, initDbSchema } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

// GET /api/workflow/projects
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
    const clientId = searchParams.get("clientId") || "";

    const conditions = ["p.user_id = $1", "p.status != 'archived'"];
    const params: any[] = [session.userId];

    let paramIdx = 2;
    if (search) {
      conditions.push(`(p.title ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (status !== "all") {
      conditions.push(`p.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    if (clientId) {
      conditions.push(`p.client_id = $${paramIdx}`);
      params.push(clientId);
      paramIdx++;
    }

    const whereClause = conditions.join(" AND ");

    const query = `
      SELECT p.*, c.name AS client_name, c.company AS client_company,
        (SELECT COUNT(*)::int FROM milestones m WHERE m.project_id = p.id) AS milestone_count,
        (SELECT COUNT(*)::int FROM milestones m WHERE m.project_id = p.id AND m.completed = true) AS completed_milestones
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE ${whereClause}
      ORDER BY p.due_date ASC NULLS LAST, p.created_at DESC;
    `;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      projects: result.rows
    });
  } catch (error: any) {
    console.error("Projects fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// POST /api/workflow/projects
export async function POST(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { title, description, client_id, status, priority, start_date, due_date, budget, currency, tags, milestones } = await req.json();
    if (!title) {
      return NextResponse.json({ success: false, message: "Project title is required." }, { status: 400 });
    }

    const pool = getDbPool();
    await initDbSchema(pool);

    // Start transaction to insert project and default milestones
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const projectResult = await client.query(
        `INSERT INTO projects (user_id, client_id, title, description, status, priority, start_date, due_date, budget, currency, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *;`,
        [
          session.userId, 
          client_id || null, 
          title, 
          description || null, 
          status || "active", 
          priority || "medium", 
          start_date || null, 
          due_date || null, 
          budget || null, 
          currency || "USD", 
          tags || []
        ]
      );
      const project = projectResult.rows[0];

      // If milestones are provided, insert them
      if (milestones && Array.isArray(milestones) && milestones.length > 0) {
        for (const m of milestones) {
          if (m.title) {
            await client.query(
              `INSERT INTO milestones (project_id, title, due_date, completed) 
               VALUES ($1, $2, $3, $4);`,
              [project.id, m.title, m.due_date || null, m.completed || false]
            );
          }
        }
      }

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Project created successfully.",
        project
      }, { status: 201 });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Project create error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
