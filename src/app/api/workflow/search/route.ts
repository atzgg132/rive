import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeWorkspaceSearch, normalizeWorkspaceSearchLimit, SEARCH_LIMIT_PER_KIND, sortWorkspaceSearchResults, workspaceSearchWhere, type WorkspaceSearchResult } from "@/lib/workspace-search";
import { contractsAvailable } from "@/utils/contracts";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export const dynamic = "force-dynamic";

function result(kind: WorkspaceSearchResult["kind"], input: Omit<WorkspaceSearchResult, "kind" | "type">): WorkspaceSearchResult {
  return { ...input, kind, type: kind };
}

// GET /api/workflow/search?q=...
export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const limit = normalizeWorkspaceSearchLimit(req.nextUrl.searchParams.get("limit"));
  const query = normalizeWorkspaceSearch(
    req.nextUrl.searchParams.get("q") ?? req.nextUrl.searchParams.get("search"),
  );
  if (!query) {
    const response = NextResponse.json({ success: true, query: "", limit, results: [] });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }

  try {
    const userId = session.userId;
    const agreementsEnabled = contractsAvailable();
    const [clients, projects, invoices, expenses, agreements] = await Promise.all([
      prisma.client.findMany({
        where: workspaceSearchWhere("client", userId, query) as Prisma.ClientWhereInput,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: Math.min(SEARCH_LIMIT_PER_KIND, limit),
        select: { id: true, name: true, company: true, email: true, status: true },
      }),
      prisma.project.findMany({
        where: workspaceSearchWhere("project", userId, query) as Prisma.ProjectWhereInput,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: Math.min(SEARCH_LIMIT_PER_KIND, limit),
        select: { id: true, title: true, status: true, client: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        where: workspaceSearchWhere("invoice", userId, query) as Prisma.InvoiceWhereInput,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: Math.min(SEARCH_LIMIT_PER_KIND, limit),
        select: { id: true, invoiceNumber: true, status: true, client: { select: { name: true } }, project: { select: { title: true } } },
      }),
      prisma.expense.findMany({
        where: workspaceSearchWhere("expense", userId, query) as Prisma.ExpenseWhereInput,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: Math.min(SEARCH_LIMIT_PER_KIND, limit),
        select: { id: true, description: true, category: true, project: { select: { title: true } } },
      }),
      agreementsEnabled
        ? prisma.contract.findMany({
            where: workspaceSearchWhere("agreement", userId, query) as Prisma.ContractWhereInput,
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            take: Math.min(SEARCH_LIMIT_PER_KIND, limit),
            select: { id: true, title: true, status: true, client: { select: { name: true } }, project: { select: { title: true } } },
          })
        : Promise.resolve([]),
    ]);

    const results = sortWorkspaceSearchResults([
      ...clients.map((client) => result("client", {
        id: client.id,
        title: client.name,
        subtitle: client.company || client.email || null,
        status: client.status,
        href: `/workflow/clients/${client.id}`,
      })),
      ...projects.map((project) => result("project", {
        id: project.id,
        title: project.title,
        subtitle: project.client?.name || null,
        status: project.status,
        href: `/workflow/projects/${project.id}`,
      })),
      ...invoices.map((invoice) => result("invoice", {
        id: invoice.id,
        title: invoice.invoiceNumber,
        subtitle: [invoice.client?.name, invoice.project?.title].filter(Boolean).join(" · ") || null,
        status: invoice.status,
        href: `/workflow/invoices/${invoice.id}`,
      })),
      ...expenses.map((expense) => result("expense", {
        id: expense.id,
        title: expense.description,
        subtitle: [expense.category, expense.project?.title].filter(Boolean).join(" · ") || null,
        status: null,
        href: `/workflow/expenses?highlight=${encodeURIComponent(expense.id)}`,
      })),
      ...agreements.map((agreement) => result("agreement", {
        id: agreement.id,
        title: agreement.title,
        subtitle: [agreement.client?.name, agreement.project?.title].filter(Boolean).join(" · ") || null,
        status: agreement.status,
        href: `/workflow/contracts/${agreement.id}`,
      })),
    ], query).slice(0, limit);

    const response = NextResponse.json({ success: true, query, limit, results });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch {
    // Keep database details and the submitted search term out of the response
    // and logs; callers only need a retryable failure.
    return NextResponse.json({ success: false, message: "Search is temporarily unavailable." }, { status: 500 });
  }
}
