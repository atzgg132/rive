import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { ensureDefaultCalendar } from "@/utils/calendar";
import { ensurePrefilledPortfolio } from "@/utils/portfolioProvisioning";
import { reconcileInvoiceNumberSequence } from "@/utils/invoiceNumber";
import { createHash } from "node:crypto";

type Row = Record<string, string>;
type Entity = "clients" | "projects" | "invoices" | "expenses" | "unknown";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_ROWS = 5_000;

function normalizeHeader(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function rowsToRecords(rows: string[][]): Row[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1, 5_001).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""])),
  );
}

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field.trim());
      field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rowsToRecords(rows);
}

async function parseUpload(file: File): Promise<{ rows: Row[]; checksum: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file/node");
    const workbookRows = await readXlsxFile(Buffer.from(bytes));
    const rows = workbookRows.map((row) => row.map((cell) => {
      if (cell instanceof Date) return cell.toISOString();
      return cell == null ? "" : String(cell);
    }));
    return { rows: rowsToRecords(rows), checksum };
  }
  return { rows: parseCsv(new TextDecoder("utf-8").decode(bytes)), checksum };
}

function value(row: Row, aliases: string[]): string {
  for (const alias of aliases) {
    const result = row[alias];
    if (result) return result.trim();
  }
  return "";
}

function detectEntity(rows: Row[]): Entity {
  const headers = new Set(Object.keys(rows[0] || {}));
  if (["expense_date", "receipt", "is_billable"].some((header) => headers.has(header))) return "expenses";
  if (["invoice_number", "invoice_no", "tax_rate", "paid_date"].some((header) => headers.has(header))) return "invoices";
  if (["project_title", "project_name", "budget", "start_date"].some((header) => headers.has(header))) return "projects";
  if (["client_name", "customer_name", "company", "phone"].some((header) => headers.has(header))) return "clients";
  if (headers.has("amount") && headers.has("category")) return "expenses";
  if (headers.has("total") && (headers.has("due_date") || headers.has("status"))) return "invoices";
  if (headers.has("email") && (headers.has("name") || headers.has("customer"))) return "clients";
  return "unknown";
}

function numberValue(input: string): number {
  const parsed = Number(input.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(input: string): Date | null {
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function normalizeKey(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function safeStatus(input: string, allowed: string[], fallback: string): string {
  const status = normalizeKey(input).replace(/\s+/g, "_");
  return allowed.includes(status) ? status : fallback;
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`onboarding-import:${session.userId}:${getRequestIp(req)}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many import attempts. Please try again later." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ success: false, message: "Upload one or more CSV files." }, { status: 400 });
  const mode = form.get("mode") === "commit" ? "commit" : "preview";
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  if (!files.length || files.length > MAX_FILES) {
    return NextResponse.json({ success: false, message: `Upload between 1 and ${MAX_FILES} CSV files.` }, { status: 400 });
  }

  const sources: Array<{ name: string; entity: Entity; rows: Row[]; headers: string[]; mimeType: string; sizeBytes: number; checksum: string }> = [];
  for (const file of files) {
    const extension = file.name.toLowerCase().split(".").pop();
    if (file.size > MAX_FILE_BYTES || !["csv", "xlsx"].includes(extension || "")) {
      return NextResponse.json({ success: false, message: `${file.name} must be a CSV or XLSX file under 2 MB.` }, { status: 400 });
    }
    const parsed = await parseUpload(file).catch(() => null);
    const rows = parsed?.rows || [];
    if (!rows.length) {
      return NextResponse.json({ success: false, message: `${file.name} has no importable rows.` }, { status: 400 });
    }
    sources.push({
      name: file.name.slice(0, 180),
      entity: detectEntity(rows),
      rows,
      headers: Object.keys(rows[0]),
      mimeType: file.type || "text/csv",
      sizeBytes: file.size,
      checksum: parsed?.checksum || "",
    });
  }
  const totalRows = sources.reduce((sum, source) => sum + source.rows.length, 0);
  if (totalRows > MAX_TOTAL_ROWS) {
    return NextResponse.json(
      {
        success: false,
        message: `Import up to ${MAX_TOTAL_ROWS.toLocaleString()} rows at a time. Split larger migrations into smaller batches.`,
      },
      { status: 400 },
    );
  }

  const preview = sources.map((source) => ({
    name: source.name,
    entity: source.entity,
    rows: source.rows.length,
    headers: source.headers,
    sample: source.rows.slice(0, 3),
    warning: source.entity === "unknown" ? "Could not confidently detect this file. Rename headers using the supplied templates." : null,
  }));
  if (mode === "preview") {
    const job = await prisma.importJob.create({
      data: {
        userId: session.userId,
        source: typeof form.get("source") === "string" ? String(form.get("source")).slice(0, 80) : "generic_csv",
        sourceLabel: typeof form.get("sourceLabel") === "string" ? String(form.get("sourceLabel")).slice(0, 160) : null,
        status: sources.some((source) => source.entity === "unknown") ? "needs_review" : "ready",
        phase: "review",
        totalRows,
        processedRows: totalRows,
        summary: { preview },
        files: {
          create: sources.map((source) => ({
            name: source.name,
            mimeType: source.mimeType,
            sizeBytes: source.sizeBytes,
            checksum: source.checksum,
            entity: source.entity,
            rowCount: source.rows.length,
            headers: source.headers,
            sample: source.rows.slice(0, 3),
          })),
        },
        issues: {
          create: sources
            .filter((source) => source.entity === "unknown")
            .map((source) => ({
              entity: "unknown",
              severity: "blocking",
              code: "ENTITY_NOT_DETECTED",
              message: `${source.name} could not be mapped to a supported record type.`,
            })),
        },
      },
      select: { id: true, status: true },
    });
    return NextResponse.json({
      success: true,
      jobId: job.id,
      jobStatus: job.status,
      preview,
      totals: Object.fromEntries(["clients", "projects", "invoices", "expenses", "unknown"].map((entity) => [
        entity,
        preview.filter((item) => item.entity === entity).reduce((sum, item) => sum + item.rows, 0),
      ])),
    });
  }
  if (sources.some((source) => source.entity === "unknown")) {
    return NextResponse.json({ success: false, message: "Resolve unrecognized CSV files before importing." }, { status: 400 });
  }

  const requestedJobId = typeof form.get("jobId") === "string" ? String(form.get("jobId")) : "";
  const existingJob = requestedJobId
    ? await prisma.importJob.findFirst({ where: { id: requestedJobId, userId: session.userId }, include: { files: true } })
    : null;
  if (requestedJobId && !existingJob) {
    return NextResponse.json({ success: false, message: "The analyzed import session could not be found." }, { status: 404 });
  }
  if (existingJob) {
    const expected = existingJob.files.map((file) => `${file.name}:${file.checksum}`).sort();
    const received = sources.map((source) => `${source.name}:${source.checksum}`).sort();
    if (expected.length !== received.length || expected.some((value, index) => value !== received[index])) {
      return NextResponse.json({ success: false, message: "The selected files changed after analysis. Analyze them again before importing." }, { status: 409 });
    }
  }
  const job = existingJob || await prisma.importJob.create({
    data: {
      userId: session.userId,
      source: typeof form.get("source") === "string" ? String(form.get("source")).slice(0, 80) : "generic_csv",
      sourceLabel: typeof form.get("sourceLabel") === "string" ? String(form.get("sourceLabel")).slice(0, 160) : null,
      status: "ready",
      phase: "review",
      totalRows,
      processedRows: totalRows,
      summary: { preview },
      files: {
        create: sources.map((source) => ({
          name: source.name,
          mimeType: source.mimeType,
          sizeBytes: source.sizeBytes,
          checksum: source.checksum,
          entity: source.entity,
          rowCount: source.rows.length,
          headers: source.headers,
          sample: source.rows.slice(0, 3),
        })),
      },
    },
    include: { files: true },
  });
  if (!["ready", "needs_review"].includes(job.status)) {
    return NextResponse.json({ success: false, message: "This import has already been finalized." }, { status: 409 });
  }
  const importFileIds = new Map(job.files.map((file) => [file.name, file.id]));
  const claimed = await prisma.importJob.updateMany({
    where: { id: job.id, userId: session.userId, status: { in: ["ready", "needs_review"] } },
    data: { status: "importing", phase: "commit", startedAt: new Date(), error: null },
  });
  if (!claimed.count) {
    return NextResponse.json({ success: false, message: "This import is already being processed." }, { status: 409 });
  }

  let report;
  try {
    report = await prisma.$transaction(async (transaction) => {
    const existingClients = await transaction.client.findMany({
      where: { userId: session.userId },
      select: { id: true, name: true, email: true },
    });
    const clientMap = new Map<string, string>();
    for (const client of existingClients) {
      clientMap.set(`name:${normalizeKey(client.name)}`, client.id);
      if (client.email) clientMap.set(`email:${normalizeKey(client.email)}`, client.id);
    }

    const existingProjects = await transaction.project.findMany({
      where: { userId: session.userId },
      select: { id: true, title: true },
    });
    const projectMap = new Map(existingProjects.map((project) => [normalizeKey(project.title), project.id]));
    const counts = { clients: 0, projects: 0, invoices: 0, expenses: 0, skipped: 0, unresolvedLinks: 0 };

    for (const source of sources.filter((item) => item.entity === "clients")) {
      for (const [rowIndex, row] of source.rows.entries()) {
        const name = value(row, ["client_name", "customer_name", "customer", "name", "contact_name"]);
        const email = value(row, ["email", "email_address", "client_email", "customer_email"]).toLowerCase();
        if (!name) {
          counts.skipped += 1;
          continue;
        }
        const existingId = (email && clientMap.get(`email:${normalizeKey(email)}`)) || clientMap.get(`name:${normalizeKey(name)}`);
        if (existingId) {
          counts.skipped += 1;
          continue;
        }
        const client = await transaction.client.create({
          data: {
            dataOrigin: "imported",
            userId: session.userId,
            name: name.slice(0, 160),
            email: /^\S+@\S+\.\S+$/.test(email) ? email : null,
            phone: value(row, ["phone", "phone_number", "mobile"]).slice(0, 80) || null,
            company: value(row, ["company", "company_name", "organization"]).slice(0, 160) || null,
            website: value(row, ["website", "url"]).slice(0, 500) || null,
            address: value(row, ["address", "billing_address"]).slice(0, 1_000) || null,
            avatarColor: "#2563EB",
            tags: [],
          },
        });
        await transaction.importedRecord.create({
          data: {
            importJobId: job.id,
            importFileId: importFileIds.get(source.name),
            sourceRow: rowIndex + 2,
            sourceType: "clients",
            sourceKey: `${source.name}:${rowIndex + 2}`,
            targetType: "client",
            targetId: client.id,
            metadata: { name, email: client.email },
          },
        });
        clientMap.set(`name:${normalizeKey(name)}`, client.id);
        if (client.email) clientMap.set(`email:${normalizeKey(client.email)}`, client.id);
        counts.clients += 1;
      }
    }

    for (const source of sources.filter((item) => item.entity === "projects")) {
      for (const [rowIndex, row] of source.rows.entries()) {
        const title = value(row, ["project_title", "project_name", "title", "name"]);
        if (!title || projectMap.has(normalizeKey(title))) {
          counts.skipped += 1;
          continue;
        }
        const clientName = value(row, ["client_name", "customer_name", "client", "customer"]);
        const clientEmail = value(row, ["client_email", "customer_email"]).toLowerCase();
        const clientId = (clientEmail && clientMap.get(`email:${normalizeKey(clientEmail)}`)) || (clientName && clientMap.get(`name:${normalizeKey(clientName)}`)) || null;
        if ((clientName || clientEmail) && !clientId) counts.unresolvedLinks += 1;
        const currency = value(row, ["currency", "currency_code"]).toUpperCase();
        const project = await transaction.project.create({
          data: {
            dataOrigin: "imported",
            userId: session.userId,
            clientId,
            title: title.slice(0, 200),
            description: value(row, ["description", "notes", "project_description"]).slice(0, 2_000) || null,
            status: safeStatus(value(row, ["status"]), ["active", "on_hold", "completed", "archived"], "active"),
            priority: safeStatus(value(row, ["priority"]), ["low", "medium", "high", "urgent"], "medium"),
            startDate: dateValue(value(row, ["start_date", "started_at"])),
            dueDate: dateValue(value(row, ["due_date", "deadline", "end_date"])),
            budget: numberValue(value(row, ["budget", "project_value", "amount"])) || null,
            currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
            tags: value(row, ["tags"]).split(/[,;|]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 20),
          },
        });
        await transaction.importedRecord.create({
          data: {
            importJobId: job.id,
            importFileId: importFileIds.get(source.name),
            sourceRow: rowIndex + 2,
            sourceType: "projects",
            sourceKey: `${source.name}:${rowIndex + 2}`,
            targetType: "project",
            targetId: project.id,
            metadata: { title, clientMatched: Boolean(clientId) },
          },
        });
        if ((clientName || clientEmail) && !clientId) {
          await transaction.importIssue.create({
            data: {
              importJobId: job.id,
              importFileId: importFileIds.get(source.name),
              sourceRow: rowIndex + 2,
              entity: "projects",
              code: "CLIENT_NOT_MATCHED",
              message: `Project "${title}" was imported without a client relationship.`,
              sourceValue: clientEmail || clientName,
            },
          });
        }
        projectMap.set(normalizeKey(title), project.id);
        counts.projects += 1;
      }
    }

    const invoiceSources = sources.filter((item) => item.entity === "invoices");
    if (invoiceSources.length > 0) await reconcileInvoiceNumberSequence(transaction, session.userId);
    const existingInvoiceNumbers = new Set((await transaction.invoice.findMany({
      where: { userId: session.userId },
      select: { invoiceNumber: true },
    })).map((invoice) => invoice.invoiceNumber.toLowerCase()));
    for (const source of invoiceSources) {
      for (let index = 0; index < source.rows.length; index += 1) {
        const row = source.rows[index];
        const invoiceNumber = (value(row, ["invoice_number", "invoice_no", "number", "invoice_id"]) || `IMPORT-${importFileIds.get(source.name) || job.id}-${index + 1}`).slice(0, 120);
        if (existingInvoiceNumbers.has(invoiceNumber.toLowerCase())) {
          counts.skipped += 1;
          continue;
        }
        const total = numberValue(value(row, ["total", "amount", "invoice_total", "balance"]));
        if (total < 0) {
          counts.skipped += 1;
          continue;
        }
        const clientName = value(row, ["client_name", "customer_name", "client", "customer"]);
        const clientEmail = value(row, ["client_email", "customer_email"]).toLowerCase();
        const projectTitle = value(row, ["project_title", "project_name", "project"]);
        const clientId = (clientEmail && clientMap.get(`email:${normalizeKey(clientEmail)}`)) || (clientName && clientMap.get(`name:${normalizeKey(clientName)}`)) || null;
        const projectId = projectTitle ? projectMap.get(normalizeKey(projectTitle)) || null : null;
        if ((clientName || clientEmail) && !clientId) counts.unresolvedLinks += 1;
        const currency = value(row, ["currency", "currency_code"]).toUpperCase();
        const status = safeStatus(value(row, ["status"]), ["draft", "sent", "viewed", "paid", "overdue", "cancelled"], "draft");
        const issueDate = dateValue(value(row, ["issue_date", "invoice_date", "date"])) || new Date();
        await reconcileInvoiceNumberSequence(transaction, session.userId, [invoiceNumber]);
        const invoice = await transaction.invoice.create({
          data: {
            dataOrigin: "imported",
            userId: session.userId,
            clientId,
            projectId,
            invoiceNumber: invoiceNumber.slice(0, 120),
            status,
            currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
            subtotal: total,
            total,
            amountPaid: status === "paid" ? total : 0,
            issueDate,
            dueDate: dateValue(value(row, ["due_date", "payment_due"])),
            paidDate: status === "paid" ? dateValue(value(row, ["paid_date", "payment_date"])) || issueDate : null,
            notes: value(row, ["notes", "memo"]).slice(0, 2_000) || null,
            items: {
              create: {
                description: value(row, ["description", "item", "service"]) || `Imported invoice ${invoiceNumber}`,
                quantity: 1,
                unitPrice: total,
                amount: total,
              },
            },
          },
        });
        await transaction.importedRecord.create({
          data: {
            importJobId: job.id,
            importFileId: importFileIds.get(source.name),
            sourceRow: index + 2,
            sourceType: "invoices",
            sourceKey: `${source.name}:${index + 2}`,
            targetType: "invoice",
            targetId: invoice.id,
            metadata: { invoiceNumber, clientMatched: Boolean(clientId), projectMatched: Boolean(projectId) },
          },
        });
        if ((clientName || clientEmail) && !clientId) {
          await transaction.importIssue.create({
            data: {
              importJobId: job.id,
              importFileId: importFileIds.get(source.name),
              sourceRow: index + 2,
              entity: "invoices",
              code: "CLIENT_NOT_MATCHED",
              message: `Invoice "${invoiceNumber}" was imported without a client relationship.`,
              sourceValue: clientEmail || clientName,
            },
          });
        }
        existingInvoiceNumbers.add(invoiceNumber.toLowerCase());
        counts.invoices += 1;
      }
    }

    for (const source of sources.filter((item) => item.entity === "expenses")) {
      for (const [rowIndex, row] of source.rows.entries()) {
        const description = value(row, ["description", "vendor", "merchant", "expense", "name"]);
        const amount = numberValue(value(row, ["amount", "total", "expense_amount"]));
        if (!description || amount <= 0) {
          counts.skipped += 1;
          continue;
        }
        const projectTitle = value(row, ["project_title", "project_name", "project"]);
        const projectId = projectTitle ? projectMap.get(normalizeKey(projectTitle)) || null : null;
        if (projectTitle && !projectId) counts.unresolvedLinks += 1;
        const currency = value(row, ["currency", "currency_code"]).toUpperCase();
        const expense = await transaction.expense.create({
          data: {
            dataOrigin: "imported",
            userId: session.userId,
            projectId,
            description: description.slice(0, 500),
            amount,
            category: normalizeKey(value(row, ["category", "expense_category"]) || "other").replace(/\s+/g, "_").slice(0, 80),
            currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
            date: dateValue(value(row, ["expense_date", "date", "transaction_date"])) || new Date(),
            isBillable: ["yes", "true", "1"].includes(normalizeKey(value(row, ["is_billable", "billable"]))),
          },
        });
        await transaction.importedRecord.create({
          data: {
            importJobId: job.id,
            importFileId: importFileIds.get(source.name),
            sourceRow: rowIndex + 2,
            sourceType: "expenses",
            sourceKey: `${source.name}:${rowIndex + 2}`,
            targetType: "expense",
            targetId: expense.id,
            metadata: { description, projectMatched: Boolean(projectId) },
          },
        });
        if (projectTitle && !projectId) {
          await transaction.importIssue.create({
            data: {
              importJobId: job.id,
              importFileId: importFileIds.get(source.name),
              sourceRow: rowIndex + 2,
              entity: "expenses",
              code: "PROJECT_NOT_MATCHED",
              message: `Expense "${description}" was imported without a project relationship.`,
              sourceValue: projectTitle,
            },
          });
        }
        counts.expenses += 1;
      }
    }

    const imported = counts.clients + counts.projects + counts.invoices + counts.expenses;
    if (imported > 0) {
      const currentUser = await transaction.user.findUnique({
        where: { id: session.userId },
        select: { onboardingData: true },
      });
      const onboardingData = currentUser?.onboardingData && typeof currentUser.onboardingData === "object" && !Array.isArray(currentUser.onboardingData)
        ? currentUser.onboardingData as Record<string, unknown>
        : {};
      await transaction.user.update({
        where: { id: session.userId },
        data: {
          onboardingStatus: "complete",
          onboardingStep: 5,
          onboardingData: {
            ...onboardingData,
            importReport: counts,
            importedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      await recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.importCommitted, module: "migration", entityType: "migration", entityId: job.id, dataOrigin: "imported", properties: { total: imported } });
    }
    return counts;
    }, { timeout: 30_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "Import failed unexpectedly.";
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "failed", phase: "commit", error: message, completedAt: new Date() },
    });
    return NextResponse.json({ success: false, jobId: job.id, message: "The import could not be completed. No partial records were saved." }, { status: 500 });
  }

  const importedCount = report.clients + report.projects + report.invoices + report.expenses;
  await prisma.$transaction([
    prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: report.unresolvedLinks > 0 ? "completed_with_issues" : "completed",
        phase: "reconciliation",
        processedRows: totalRows,
        createdRecords: importedCount,
        skippedRecords: report.skipped,
        unresolvedCount: report.unresolvedLinks,
        summary: report,
        completedAt: new Date(),
      },
    }),
    // `audit_events` is unique on (user, action), so a plain create threw
    // P2002 on a user's *second* import — after the records had already been
    // written, leaving a successful import reported as a server error.
    prisma.auditEvent.upsert({
      where: { userId_action: { userId: session.userId, action: "import.completed" } },
      update: { targetId: job.id, metadata: report },
      create: {
        userId: session.userId,
        action: "import.completed",
        targetType: "import_job",
        targetId: job.id,
        metadata: report,
      },
    }),
  ]);

  if (report.clients + report.projects + report.invoices + report.expenses > 0) {
    await Promise.all([
      ensureDefaultCalendar(session.userId),
      ensurePrefilledPortfolio(session.userId),
    ]);
  }

  return NextResponse.json({ success: true, jobId: job.id, report });
}
