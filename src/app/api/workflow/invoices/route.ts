import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { calculateInvoice } from "@/utils/invoiceMath";
import { nextInvoiceNumber } from "@/utils/invoiceNumber";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { refreshOverdueInvoices } from "@/utils/invoiceLifecycle";
import { buildPagination, paginationOffset, parsePagination } from "@/lib/pagination";

const EDITABLE_INVOICE_STATUSES = new Set(["draft"]);
const INVOICE_NUMBER_MAX_LENGTH = 80;
const MAX_LINE_ITEMS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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
    const quantityInput = typeof rawItem.quantity === "number" ? String(rawItem.quantity) : typeof rawItem.quantity === "string" ? rawItem.quantity.trim() : "";
    const unitPriceValue = rawItem.unit_price ?? rawItem.unitPrice;
    const unitPriceInput = typeof unitPriceValue === "number" ? String(unitPriceValue) : typeof unitPriceValue === "string" ? unitPriceValue.trim() : "";
    const quantity = Number(quantityInput);
    const unitPrice = Number(unitPriceInput);
    if (!description) throw new Error(`Line item ${index + 1} needs a description.`);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) throw new Error(`Line item ${index + 1} needs a valid positive quantity.`);
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000_000) throw new Error(`Line item ${index + 1} has an invalid rate.`);
    return { description, quantity: quantityInput, unitPrice: unitPriceInput, amount: 0, sortOrder: index };
  });
}

function parsePercentage(value: unknown, fallback: string | number = 0): string | "invalid" {
  if (value === undefined || value === null || value === "") return String(fallback);
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 && /^\d+(?:\.\d+)?$/.test(raw) ? raw : "invalid";
}

function parseTaxRate(value: unknown, fallback: string | number = 0): string | "invalid" {
  return parsePercentage(value, fallback);
}

// GET /api/workflow/invoices
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    await refreshOverdueInvoices(session.userId);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const invoiceId = searchParams.get("id") || "";
    const clientId = searchParams.get("clientId") || "";
    const projectId = searchParams.get("projectId") || "";
    const includeItems = Boolean(invoiceId);
    const requestedPagination = parsePagination(searchParams, invoiceId ? { pageSize: 1, minPageSize: 1 } : undefined);

    const where: Prisma.InvoiceWhereInput = {
      userId: session.userId
    };

    if (invoiceId) {
      where.id = invoiceId;
    }
    if (clientId) {
      where.clientId = clientId;
    }
    if (projectId) {
      where.projectId = projectId;
    }

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

    const total = await prisma.invoice.count({ where });
    const pagination = buildPagination(total, requestedPagination);
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: { select: { name: true } },
        project: { select: { title: true } },
        ...(includeItems ? { items: { orderBy: { sortOrder: "asc" } } } : {}),
        billingOccurrence: {
          select: { contract: { select: { id: true, title: true } } }
        }
      },
      orderBy: [
        { dueDate: "asc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: paginationOffset(pagination),
      take: pagination.pageSize,
    });

    const formattedInvoices = invoices.map((i) => {
      const lineItems = "items" in i && Array.isArray(i.items) ? i.items : [];
      return {
        id: i.id,
        client_id: i.clientId,
        project_id: i.projectId,
        invoice_number: i.invoiceNumber,
        status: i.status,
        currency: i.currency,
        subtotal: i.subtotal.toString(),
        tax_rate: i.taxRate.toString(),
        discount_rate: i.discountRate.toString(),
        discount_amount: i.discountAmount.toString(),
        tax_amount: i.taxAmount.toString(),
        total: i.total.toString(),
        amount_paid: i.amountPaid.toString(),
        outstanding: i.total.sub(i.amountPaid).toString(),
        issue_date: i.issueDate,
        due_date: i.dueDate,
        paid_date: i.paidDate,
        sent_at: i.sentAt,
        reviewed_at: i.reviewedAt,
        viewed_at: i.viewedAt,
        voided_at: i.voidedAt,
        notes: i.notes,
        created_at: i.createdAt,
        updated_at: i.updatedAt,
        client_name: i.client?.name || null,
        project_title: i.project?.title || null,
        contract_id: i.billingOccurrence?.contract.id || null,
        contract_title: i.billingOccurrence?.contract.title || null,
        items: lineItems.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity.toString(),
          unit_price: item.unitPrice.toString(),
          amount: item.amount.toString(),
        })),
      };
    });

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices,
      pagination,
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

    const requestedInvoiceNumber = cleanText(body.invoice_number, INVOICE_NUMBER_MAX_LENGTH);

    let computedItems: ReturnType<typeof normalizeItems>;
    try {
      computedItems = normalizeItems(body.items);
    } catch (error) {
      return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Invalid invoice line items." }, { status: 400 });
    }
    const projectId = cleanText(body.project_id, 80) || null;
    let clientId = cleanText(body.client_id, 80) || null;
    const [linkedProject, owner, invoiceProfile] = await Promise.all([
      projectId ? prisma.project.findFirst({ where: { id: projectId, userId: session.userId }, select: { id: true, clientId: true, currency: true } }) : null,
      prisma.user.findUnique({ where: { id: session.userId }, select: { currency: true } }),
      prisma.invoiceProfile.findUnique({ where: { userId: session.userId }, select: { invoicePrefix: true } }),
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
    const discountRate = parsePercentage(body.discount_rate);
    if (discountRate === "invalid") return NextResponse.json({ success: false, message: "Discount rate must be between 0 and 100." }, { status: 400 });
    const issueDateInput = parseOptionalDate(body.issue_date);
    const dueDate = parseOptionalDate(body.due_date);
    if (issueDateInput === "invalid" || dueDate === "invalid") return NextResponse.json({ success: false, message: "Use valid invoice dates." }, { status: 400 });
    const issueDate = issueDateInput || new Date();
    if (dueDate && dueDate < issueDate) return NextResponse.json({ success: false, message: "Invoice due date cannot be before its issue date." }, { status: 400 });
    let calculation: ReturnType<typeof calculateInvoice>;
    try {
      calculation = calculateInvoice(computedItems.map((item) => ({ description: item.description, quantity: String(item.quantity), unitPrice: String(item.unitPrice), sortOrder: item.sortOrder })), String(taxRate), currency, String(discountRate));
    } catch (error) {
      return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Invalid invoice amounts." }, { status: 400 });
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = requestedInvoiceNumber || await nextInvoiceNumber(tx, session.userId, invoiceProfile?.invoicePrefix || "INV", issueDate);
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
          subtotal: calculation.subtotal,
          taxRate: calculation.taxRate,
          discountRate: calculation.discountRate,
          discountAmount: calculation.discountAmount,
          taxAmount: calculation.taxAmount,
          total: calculation.total,
          dataOrigin: "user",
          issueDate,
          dueDate,
          notes: cleanText(body.notes, 10_000) || null,
        }
      });

      const lineItems = calculation.items.map((item) => ({
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
    await recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.invoiceCreated, module: "invoices", entityType: "invoice", entityId: invoice.id, dataOrigin: "user" });

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
    if (requestedStatus === "paid" || requestedStatus === "partially_paid") {
      return NextResponse.json({ success: false, message: "Use the payment action so the payment ledger and invoice status stay consistent." }, { status: 409 });
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { billingOccurrence: true, items: { orderBy: { sortOrder: "asc" } } },
    });

    if (!existingInvoice || existingInvoice.userId !== session.userId) {
      return NextResponse.json({ success: false, message: "Invoice not found or unauthorized." }, { status: 404 });
    }

    const contentFields = ["client_id", "project_id", "invoice_number", "currency", "tax_rate", "discount_rate", "notes", "due_date", "issue_date", "items"];
    const contentEditRequested = contentFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
    if (!contentEditRequested && !requestedStatus) return NextResponse.json({ success: false, message: "No invoice changes were provided." }, { status: 400 });
    if (contentEditRequested && !EDITABLE_INVOICE_STATUSES.has(existingInvoice.status)) {
      return NextResponse.json({ success: false, message: "Issued, paid, cancelled, or in-flight invoices are immutable. Create a corrective invoice instead." }, { status: 409 });
    }
    if (requestedStatus && requestedStatus !== existingInvoice.status) {
      const mayCancelDraft = requestedStatus === "cancelled" && existingInvoice.status === "draft";
      if (!mayCancelDraft) return NextResponse.json({ success: false, message: `Invoice cannot move from ${existingInvoice.status} to ${requestedStatus} through this action.` }, { status: 409 });
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
    const discountRate = parsePercentage(body.discount_rate, Number(existingInvoice.discountRate));
    if (discountRate === "invalid") return NextResponse.json({ success: false, message: "Discount rate must be between 0 and 100." }, { status: 400 });
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
    let calculation: ReturnType<typeof calculateInvoice> | null = null;
    const pricingEditRequested = Boolean(computedItems)
      || Object.prototype.hasOwnProperty.call(body, "tax_rate")
      || Object.prototype.hasOwnProperty.call(body, "discount_rate")
      || Object.prototype.hasOwnProperty.call(body, "currency");
    if (pricingEditRequested) {
      try {
        const sourceItems = computedItems || existingInvoice.items.map((item) => ({ description: item.description, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString(), sortOrder: item.sortOrder }));
        calculation = calculateInvoice(sourceItems.map((item) => ({ description: item.description, quantity: String(item.quantity), unitPrice: String(item.unitPrice), sortOrder: item.sortOrder })), String(taxRate), nextCurrency, String(discountRate));
      } catch (error) {
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Invalid invoice amounts." }, { status: 400 });
      }
    }
    const subtotal = calculation?.subtotal || existingInvoice.subtotal;

    if (existingInvoice.billingOccurrence) {
      if (targetClientId !== existingInvoice.clientId || targetProjectId !== existingInvoice.projectId || nextCurrency !== existingInvoice.currency) {
        return NextResponse.json({ success: false, message: "Client, project, and currency come from the executed contract and cannot be changed on this generated invoice." }, { status: 409 });
      }
      if (calculation && (!calculation.subtotal.equals(existingInvoice.subtotal) || !calculation.discountRate.equals(existingInvoice.discountRate))) {
        return NextResponse.json({ success: false, message: "The contracted fee cannot be changed on its generated invoice. Amend the contract or create a separate adjustment invoice." }, { status: 409 });
      }
    }

    const dataToUpdate: Prisma.InvoiceUncheckedUpdateInput = contentEditRequested ? {
      clientId: targetClientId,
      projectId: targetProjectId,
      invoiceNumber,
      currency: nextCurrency,
      taxRate: calculation?.taxRate ?? existingInvoice.taxRate,
      discountRate: calculation?.discountRate ?? existingInvoice.discountRate,
      discountAmount: calculation?.discountAmount ?? existingInvoice.discountAmount,
      taxAmount: calculation?.taxAmount ?? existingInvoice.taxAmount,
      subtotal,
      total: calculation?.total ?? existingInvoice.total,
      notes: body.notes !== undefined ? cleanText(body.notes, 10_000) || null : existingInvoice.notes,
      issueDate,
      dueDate,
      reviewedAt: new Date(),
    } : {};
    if (requestedStatus) dataToUpdate.status = requestedStatus;
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
        
        await tx.invoiceItem.createMany({ data: calculation!.items.map((item) => ({
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
    if (existingInvoice.sentAt || existingInvoice.sentSnapshot || ["sent", "viewed", "overdue", "partially_paid", "paid", "voided"].includes(existingInvoice.status)) {
      return NextResponse.json({ success: false, message: "Issued invoices cannot be deleted; retain them for the audit trail." }, { status: 409 });
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
