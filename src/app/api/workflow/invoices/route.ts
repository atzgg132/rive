import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

const EDITABLE_INVOICE_STATUSES = new Set(["draft", "overdue"]);
const INVOICE_NUMBER_MAX_LENGTH = 80;
const MAX_LINE_ITEMS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseOptionalDate(value: unknown): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "invalid" : parsed;
}

function normalizeItems(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Add at least one invoice line item.");
  if (value.length > MAX_LINE_ITEMS) throw new Error(`An invoice can have at most ${MAX_LINE_ITEMS} line items.`);
  return value.map((rawItem, index) => {
    if (!isRecord(rawItem)) throw new Error(`Line item ${index + 1} is invalid.`);
    const description = cleanText(rawItem.description, 240);
    const quantity = Number(rawItem.quantity);
    const unitPrice = Number(rawItem.unit_price ?? rawItem.unitPrice);
    if (!description) throw new Error(`Line item ${index + 1} needs a description.`);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) throw new Error(`Line item ${index + 1} needs a valid positive quantity.`);
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000_000) throw new Error(`Line item ${index + 1} has an invalid rate.`);
    const amount = roundMoney(quantity * unitPrice);
    if (amount > 1_000_000_000) throw new Error(`Line item ${index + 1} exceeds the supported amount.`);
    return { description, quantity, unitPrice: roundMoney(unitPrice), amount, sortOrder: index };
  });
}

function parseTaxRate(value: unknown, fallback = 0): number | "invalid" {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? roundMoney(parsed) : "invalid";
}

// GET /api/workflow/invoices
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";

    const where: Prisma.InvoiceWhereInput = {
      userId: session.userId
    };

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { client: { name: { contains: search, mode: "insensitive" } } },
        { project: { title: { contains: search, mode: "insensitive" } } }
      ];
    }

    if (status !== "all") {
      where.status = status;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: { select: { name: true } },
        project: { select: { title: true } },
        items: {
          orderBy: { sortOrder: 'asc' }
        },
        billingOccurrence: {
          select: { contract: { select: { id: true, title: true } } }
        }
      },
      orderBy: [
        { dueDate: "asc" },
        { createdAt: "desc" }
      ]
    });

    const formattedInvoices = invoices.map((i) => ({
      id: i.id,
      client_id: i.clientId,
      project_id: i.projectId,
      invoice_number: i.invoiceNumber,
      status: i.status,
      currency: i.currency,
      subtotal: i.subtotal.toString(),
      tax_rate: i.taxRate.toString(),
      tax_amount: i.taxAmount.toString(),
      total: i.total.toString(),
      issue_date: i.issueDate,
      due_date: i.dueDate,
      paid_date: i.paidDate,
      sent_at: i.sentAt,
      reviewed_at: i.reviewedAt,
      notes: i.notes,
      created_at: i.createdAt,
      updated_at: i.updatedAt,
      client_name: i.client?.name || null,
      project_title: i.project?.title || null,
      contract_id: i.billingOccurrence?.contract.id || null,
      contract_title: i.billingOccurrence?.contract.title || null,
      items: (i.items || []).map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unitPrice.toString(),
        amount: item.amount.toString()
      }))
    }));

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices
    });
  } catch (error: unknown) {
    console.error("Invoices fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// POST /api/workflow/invoices
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!isRecord(body)) return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });

    const invoiceNumber = cleanText(body.invoice_number, INVOICE_NUMBER_MAX_LENGTH);
    if (!invoiceNumber) return NextResponse.json({ success: false, message: "Invoice number is required." }, { status: 400 });

    let computedItems: ReturnType<typeof normalizeItems>;
    try {
      computedItems = normalizeItems(body.items);
    } catch (error) {
      return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Invalid invoice line items." }, { status: 400 });
    }
    const subtotal = roundMoney(computedItems.reduce((sum, item) => sum + item.amount, 0));
    if (subtotal <= 0) return NextResponse.json({ success: false, message: "Invoice subtotal must be greater than zero." }, { status: 400 });

    const projectId = cleanText(body.project_id, 80) || null;
    let clientId = cleanText(body.client_id, 80) || null;
    const [linkedProject, owner] = await Promise.all([
      projectId ? prisma.project.findFirst({ where: { id: projectId, userId: session.userId }, select: { id: true, clientId: true, currency: true } }) : null,
      prisma.user.findUnique({ where: { id: session.userId }, select: { currency: true } }),
    ]);
    if (projectId && !linkedProject) return NextResponse.json({ success: false, message: "Project not found or unauthorized." }, { status: 404 });
    if (!owner) return NextResponse.json({ success: false, message: "Workspace owner not found." }, { status: 404 });
    if (!clientId && linkedProject?.clientId) clientId = linkedProject.clientId;
    const linkedClient = clientId ? await prisma.client.findFirst({ where: { id: clientId, userId: session.userId }, select: { id: true } }) : null;
    if (clientId && !linkedClient) return NextResponse.json({ success: false, message: "Client not found or unauthorized." }, { status: 404 });
    if (linkedProject?.clientId && linkedProject.clientId !== clientId) return NextResponse.json({ success: false, message: "The selected project belongs to a different client." }, { status: 400 });

    const currency = cleanText(body.currency ?? linkedProject?.currency ?? owner.currency, 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ success: false, message: "Use a valid three-letter invoice currency." }, { status: 400 });
    const taxRate = parseTaxRate(body.tax_rate);
    if (taxRate === "invalid") return NextResponse.json({ success: false, message: "Tax rate must be between 0 and 100." }, { status: 400 });
    const issueDateInput = parseOptionalDate(body.issue_date);
    const dueDate = parseOptionalDate(body.due_date);
    if (issueDateInput === "invalid" || dueDate === "invalid") return NextResponse.json({ success: false, message: "Use valid invoice dates." }, { status: 400 });
    const issueDate = issueDateInput || new Date();
    if (dueDate && dueDate < issueDate) return NextResponse.json({ success: false, message: "Invoice due date cannot be before its issue date." }, { status: 400 });
    const taxAmount = roundMoney(subtotal * (taxRate / 100));
    const total = roundMoney(subtotal + taxAmount);

    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({
        where: {
          unique_user_invoice_number: {
            userId: session.userId,
            invoiceNumber,
          }
        }
      });

      if (existing) {
        throw new Error(`Invoice number "${invoiceNumber}" is already in use.`);
      }

      const inv = await tx.invoice.create({
        data: {
          userId: session.userId,
          clientId,
          projectId,
          invoiceNumber,
          status: "draft",
          currency,
          subtotal,
          taxRate,
          taxAmount,
          total,
          issueDate,
          dueDate,
          notes: cleanText(body.notes, 10_000) || null,
        }
      });

      const lineItems = computedItems.map((item) => ({
        invoiceId: inv.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        sortOrder: item.sortOrder
      }));

      await tx.invoiceItem.createMany({
        data: lineItems
      });

      return inv;
    });

    return NextResponse.json({
      success: true,
      message: "Invoice created successfully.",
      invoice
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("Invoice create error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: false, message: "That invoice number is already in use." }, { status: 409 });
    }
    const message = error instanceof Error && error.message.includes("already in use") ? error.message : "Unable to create invoice.";
    return NextResponse.json({ success: false, message }, { status: message.includes("already in use") ? 409 : 500 });
  }
}

// PUT /api/workflow/invoices
export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!isRecord(body)) return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
    const id = cleanText(body.id, 80);
    if (!id) {
      return NextResponse.json({ success: false, message: "Invoice ID is required." }, { status: 400 });
    }

    const requestedStatus = body.status === undefined ? null : cleanText(body.status, 24);
    if (requestedStatus === "sent") {
      return NextResponse.json({ success: false, message: "Use the explicit invoice send action so delivery is recorded before the invoice becomes sent." }, { status: 409 });
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { billingOccurrence: true },
    });

    if (!existingInvoice || existingInvoice.userId !== session.userId) {
      return NextResponse.json({ success: false, message: "Invoice not found or unauthorized." }, { status: 404 });
    }

    const contentFields = ["client_id", "project_id", "invoice_number", "currency", "tax_rate", "notes", "due_date", "issue_date", "items"];
    const contentEditRequested = contentFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
    if (!contentEditRequested && !requestedStatus) return NextResponse.json({ success: false, message: "No invoice changes were provided." }, { status: 400 });
    if (contentEditRequested && !EDITABLE_INVOICE_STATUSES.has(existingInvoice.status)) {
      return NextResponse.json({ success: false, message: "Issued, paid, cancelled, or in-flight invoices are immutable. Create a corrective invoice instead." }, { status: 409 });
    }
    if (requestedStatus && requestedStatus !== existingInvoice.status) {
      const mayMarkPaid = requestedStatus === "paid" && !["cancelled", "sending"].includes(existingInvoice.status);
      const mayCancelDraft = requestedStatus === "cancelled" && existingInvoice.status === "draft";
      if (!mayMarkPaid && !mayCancelDraft) return NextResponse.json({ success: false, message: `Invoice cannot move from ${existingInvoice.status} to ${requestedStatus} through this action.` }, { status: 409 });
    }

    const targetProjectId = body.project_id !== undefined ? cleanText(body.project_id, 80) || null : existingInvoice.projectId;
    let targetClientId = body.client_id !== undefined ? cleanText(body.client_id, 80) || null : existingInvoice.clientId;
    const [linkedClient, linkedProject] = await Promise.all([
      targetClientId ? prisma.client.findFirst({ where: { id: targetClientId, userId: session.userId }, select: { id: true } }) : null,
      targetProjectId ? prisma.project.findFirst({ where: { id: targetProjectId, userId: session.userId }, select: { id: true, clientId: true, currency: true } }) : null,
    ]);
    if (targetProjectId && !linkedProject) return NextResponse.json({ success: false, message: "Project not found or unauthorized." }, { status: 404 });
    if (!targetClientId && linkedProject?.clientId) targetClientId = linkedProject.clientId;
    const resolvedClient = targetClientId && linkedClient?.id !== targetClientId
      ? await prisma.client.findFirst({ where: { id: targetClientId, userId: session.userId }, select: { id: true } })
      : linkedClient;
    if (targetClientId && !resolvedClient) return NextResponse.json({ success: false, message: "Client not found or unauthorized." }, { status: 404 });
    if (linkedProject?.clientId && linkedProject.clientId !== targetClientId) return NextResponse.json({ success: false, message: "The selected project belongs to a different client." }, { status: 400 });

    const invoiceNumber = body.invoice_number !== undefined ? cleanText(body.invoice_number, INVOICE_NUMBER_MAX_LENGTH) : existingInvoice.invoiceNumber;
    if (!invoiceNumber) return NextResponse.json({ success: false, message: "Invoice number is required." }, { status: 400 });
    const nextCurrency = body.currency !== undefined ? cleanText(body.currency, 3).toUpperCase() : existingInvoice.currency;
    if (!/^[A-Z]{3}$/.test(nextCurrency)) return NextResponse.json({ success: false, message: "Use a valid three-letter invoice currency." }, { status: 400 });
    const taxRate = parseTaxRate(body.tax_rate, Number(existingInvoice.taxRate));
    if (taxRate === "invalid") return NextResponse.json({ success: false, message: "Tax rate must be between 0 and 100." }, { status: 400 });
    const issueDateInput = body.issue_date !== undefined ? parseOptionalDate(body.issue_date) : existingInvoice.issueDate;
    const dueDate = body.due_date !== undefined ? parseOptionalDate(body.due_date) : existingInvoice.dueDate;
    if (issueDateInput === "invalid" || dueDate === "invalid") return NextResponse.json({ success: false, message: "Use valid invoice dates." }, { status: 400 });
    const issueDate = issueDateInput || existingInvoice.issueDate;
    if (dueDate && dueDate < issueDate) return NextResponse.json({ success: false, message: "Invoice due date cannot be before its issue date." }, { status: 400 });

    let computedItems: ReturnType<typeof normalizeItems> | null = null;
    if (Object.prototype.hasOwnProperty.call(body, "items")) {
      try {
        computedItems = normalizeItems(body.items);
      } catch (error) {
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Invalid invoice line items." }, { status: 400 });
      }
    }
    const subtotal = computedItems ? roundMoney(computedItems.reduce((sum, item) => sum + item.amount, 0)) : Number(existingInvoice.subtotal);
    if (subtotal <= 0) return NextResponse.json({ success: false, message: "Invoice subtotal must be greater than zero." }, { status: 400 });

    if (existingInvoice.billingOccurrence) {
      if (targetClientId !== existingInvoice.clientId || targetProjectId !== existingInvoice.projectId || nextCurrency !== existingInvoice.currency) {
        return NextResponse.json({ success: false, message: "Client, project, and currency come from the executed contract and cannot be changed on this generated invoice." }, { status: 409 });
      }
      if (Math.abs(subtotal - Number(existingInvoice.subtotal)) >= 0.01) {
        return NextResponse.json({ success: false, message: "The contracted fee cannot be changed on its generated invoice. Amend the contract or create a separate adjustment invoice." }, { status: 409 });
      }
    }

    const taxAmount = roundMoney(subtotal * (taxRate / 100));
    const total = roundMoney(subtotal + taxAmount);
    const dataToUpdate: Prisma.InvoiceUncheckedUpdateInput = contentEditRequested ? {
      clientId: targetClientId,
      projectId: targetProjectId,
      invoiceNumber,
      currency: nextCurrency,
      taxRate,
      taxAmount,
      subtotal,
      total,
      notes: body.notes !== undefined ? cleanText(body.notes, 10_000) || null : existingInvoice.notes,
      issueDate,
      dueDate,
      reviewedAt: new Date(),
    } : {};
    if (requestedStatus) dataToUpdate.status = requestedStatus;
    if (requestedStatus === "paid" && existingInvoice.status !== "paid") dataToUpdate.paidDate = new Date();
    if (requestedStatus === "cancelled") dataToUpdate.paidDate = null;

    await prisma.$transaction(async (tx) => {
      if (invoiceNumber !== existingInvoice.invoiceNumber) {
        const existing = await tx.invoice.findUnique({
          where: {
            unique_user_invoice_number: {
              userId: session.userId,
              invoiceNumber,
            }
          }
        });

        if (existing) {
          throw new Error(`Invoice number "${dataToUpdate.invoiceNumber}" is already in use.`);
        }
      }

      if (computedItems) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoice.update({
          where: { id },
          data: dataToUpdate
        });
        
        await tx.invoiceItem.createMany({ data: computedItems.map((item) => ({
          invoiceId: id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          sortOrder: item.sortOrder,
        })) });
      } else {
        await tx.invoice.update({
          where: { id },
          data: dataToUpdate
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Invoice updated successfully."
    });
  } catch (error: unknown) {
    console.error("Invoice update error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: false, message: "That invoice number is already in use." }, { status: 409 });
    }
    const message = error instanceof Error && error.message.includes("already in use") ? error.message : "Unable to update invoice.";
    return NextResponse.json({ success: false, message }, { status: message.includes("already in use") ? 409 : 500 });
  }
}

// DELETE /api/workflow/invoices
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Invoice ID is required." }, { status: 400 });
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { billingOccurrence: true },
    });

    if (!existingInvoice || existingInvoice.userId !== session.userId) {
      return NextResponse.json({ success: false, message: "Invoice not found or unauthorized." }, { status: 404 });
    }
    if (existingInvoice.billingOccurrence) {
      return NextResponse.json({ success: false, message: "A milestone-linked invoice is retained with its contract billing record and cannot be deleted." }, { status: 409 });
    }
    if (["sent", "paid"].includes(existingInvoice.status)) {
      return NextResponse.json({ success: false, message: "Sent or paid invoices cannot be deleted; retain them for the audit trail." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    return NextResponse.json({
      success: true,
      message: "Invoice deleted successfully."
    });
  } catch (error: unknown) {
    console.error("Invoice delete error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
