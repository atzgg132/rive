import { NextRequest, NextResponse } from "next/server";
import { getDbPool, initDbSchema } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

// GET /api/workflow/invoices
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

    const conditions = ["i.user_id = $1"];
    const params: any[] = [session.userId];

    let paramIdx = 2;
    if (search) {
      conditions.push(`(i.invoice_number ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx} OR p.title ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (status !== "all") {
      conditions.push(`i.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const whereClause = conditions.join(" AND ");

    const query = `
      SELECT i.*, c.name AS client_name, p.title AS project_title
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE ${whereClause}
      ORDER BY i.due_date ASC NULLS LAST, i.created_at DESC;
    `;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      invoices: result.rows
    });
  } catch (error: any) {
    console.error("Invoices fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// POST /api/workflow/invoices
export async function POST(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { 
      client_id, 
      project_id, 
      invoice_number, 
      status, 
      currency, 
      tax_rate, 
      notes, 
      due_date, 
      issue_date, 
      items 
    } = await req.json();

    if (!invoice_number || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "Invoice number and line items are required." }, { status: 400 });
    }

    const pool = getDbPool();
    await initDbSchema(pool);

    // Calculate subtotal and total
    let subtotal = 0;
    const computedItems = items.map((item: any, idx: number) => {
      const quantity = parseFloat(item.quantity) || 1;
      const unitPrice = parseFloat(item.unit_price) || 0;
      const amount = quantity * unitPrice;
      subtotal += amount;
      return {
        description: item.description || "line item",
        quantity,
        unit_price: unitPrice,
        amount,
        sort_order: idx
      };
    });

    const taxRate = parseFloat(tax_rate) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Use a transaction connection
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Verify invoice number is unique for this user
      const existing = await client.query(
        "SELECT id FROM invoices WHERE user_id = $1 AND invoice_number = $2;",
        [session.userId, invoice_number]
      );
      if (existing.rows.length > 0) {
        throw new Error(`Invoice number "${invoice_number}" is already in use.`);
      }

      // Insert invoice
      const invoiceResult = await client.query(
        `INSERT INTO invoices (user_id, client_id, project_id, invoice_number, status, currency, subtotal, tax_rate, tax_amount, total, issue_date, due_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *;`,
        [
          session.userId, 
          client_id || null, 
          project_id || null, 
          invoice_number, 
          status || "draft", 
          currency || "USD", 
          subtotal, 
          taxRate, 
          taxAmount, 
          total, 
          issue_date || new Date().toISOString().split("T")[0],
          due_date || null, 
          notes || null
        ]
      );
      const invoice = invoiceResult.rows[0];

      // Insert line items
      for (const item of computedItems) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6);`,
          [invoice.id, item.description, item.quantity, item.unit_price, item.amount, item.sort_order]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Invoice created successfully.",
        invoice
      }, { status: 201 });
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Invoice create error:", error);
    return NextResponse.json({ success: false, message: error.message || "Internal server error." }, { status: 500 });
  }
}
