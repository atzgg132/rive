import "server-only";

import { prisma } from "@/utils/db";
import {
  evaluateActivation,
  hasRealDataRecords,
  REAL_DATA_ORIGINS,
  summarizeFunnelUser,
  type ActivationFacts,
  type FunnelUserSummary,
  type QualificationUser,
} from "@/utils/funnelDefinitions";

export type WorkspaceSlice = {
  clients: Array<{ id: string; createdAt: Date }>;
  projects: Array<{ id: string; clientId: string | null; dueDate: Date | string | null; createdAt: Date }>;
  invoices: Array<{ projectId: string | null; clientId: string | null; createdAt: Date }>;
  expenses: Array<{ projectId: string | null; createdAt: Date }>;
  calendarEvents: Array<{ projectId: string | null; clientId: string | null; createdAt: Date }>;
  importJobs: Array<{ completedAt: Date | null; createdAt: Date; unresolvedCount: number; records: Array<{ targetType: string }> }>;
  portfolios: Array<{ publishedAt: Date | null; content: unknown }>;
};

function emptySlice(): WorkspaceSlice {
  return { clients: [], projects: [], invoices: [], expenses: [], calendarEvents: [], importJobs: [], portfolios: [] };
}

export async function loadWorkspaceSlices(userIds: string[]): Promise<Map<string, WorkspaceSlice>> {
  const slices = new Map<string, WorkspaceSlice>();
  for (const userId of userIds) slices.set(userId, emptySlice());
  if (userIds.length === 0) return slices;

  const [clients, projects, invoices, expenses, calendarEvents, importJobs, portfolios] = await Promise.all([
    prisma.client.findMany({
      where: { userId: { in: userIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } },
      select: { id: true, userId: true, createdAt: true },
    }),
    prisma.project.findMany({
      where: { userId: { in: userIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } },
      select: { id: true, userId: true, clientId: true, dueDate: true, createdAt: true },
    }),
    prisma.invoice.findMany({
      where: { userId: { in: userIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } },
      select: { userId: true, projectId: true, clientId: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { userId: { in: userIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } },
      select: { userId: true, projectId: true, createdAt: true },
    }),
    prisma.calendarEvent.findMany({
      where: { userId: { in: userIds }, deletedAt: null, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } },
      select: { userId: true, projectId: true, clientId: true, createdAt: true },
    }),
    prisma.importJob.findMany({
      where: { userId: { in: userIds }, status: { in: ["completed", "completed_with_issues"] } },
      select: { userId: true, unresolvedCount: true, completedAt: true, createdAt: true, records: { select: { targetType: true } } },
    }),
    prisma.portfolio.findMany({
      where: { userId: { in: userIds }, status: "published", publishedAt: { not: null } },
      select: { userId: true, publishedAt: true, content: true },
    }),
  ]);

  const push = <T extends { userId: string }>(rows: T[], key: keyof WorkspaceSlice, map: (row: T) => WorkspaceSlice[typeof key][number]) => {
    for (const row of rows) {
      const slice = slices.get(row.userId);
      if (!slice) continue;
      (slice[key] as Array<unknown>).push(map(row));
    }
  };

  push(clients, "clients", (row) => ({ id: row.id, createdAt: row.createdAt }));
  push(projects, "projects", (row) => ({ id: row.id, clientId: row.clientId, dueDate: row.dueDate, createdAt: row.createdAt }));
  push(invoices, "invoices", (row) => ({ projectId: row.projectId, clientId: row.clientId, createdAt: row.createdAt }));
  push(expenses, "expenses", (row) => ({ projectId: row.projectId, createdAt: row.createdAt }));
  push(calendarEvents, "calendarEvents", (row) => ({ projectId: row.projectId, clientId: row.clientId, createdAt: row.createdAt }));
  push(importJobs, "importJobs", (row) => ({ completedAt: row.completedAt, createdAt: row.createdAt, unresolvedCount: row.unresolvedCount, records: row.records }));
  push(portfolios, "portfolios", (row) => ({ publishedAt: row.publishedAt, content: row.content }));
  return slices;
}

export function funnelSummaryForUser(user: QualificationUser & { createdAt: Date }, slice: WorkspaceSlice): FunnelUserSummary & {
  activation: ReturnType<typeof evaluateActivation>;
  workspace: { clients: number; projects: number; invoices: number; expenses: number; calendarEvents: number; publishedPortfolios: number };
} {
  const facts: ActivationFacts = {
    signupAt: user.createdAt,
    clients: slice.clients,
    projects: slice.projects,
    invoices: slice.invoices,
    expenses: slice.expenses,
    calendarEvents: slice.calendarEvents,
    importJobs: slice.importJobs,
    portfolios: slice.portfolios,
  };
  const activation = evaluateActivation(facts);
  const counts = {
    clients: slice.clients.length,
    projects: slice.projects.length,
    invoices: slice.invoices.length,
    expenses: slice.expenses.length,
    calendarEvents: slice.calendarEvents.length,
  };
  return {
    ...summarizeFunnelUser({ user, activation, realData: hasRealDataRecords(counts) }),
    activation,
    workspace: { ...counts, publishedPortfolios: slice.portfolios.length },
  };
}
