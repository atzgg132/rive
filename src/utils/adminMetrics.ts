import "server-only";

import { prisma } from "@/utils/db";
import { acquisitionSource, FUNNEL_DEFINITION_VERSION, isMeaningfulProductEvent, isQualifiedUser, INTERNAL_ACCOUNT_TYPES, REAL_DATA_ORIGINS } from "@/utils/funnelDefinitions";

type UserRow = {
  id: string; email: string; name: string | null; createdAt: Date; accountType: string; emailVerifiedAt: Date | null; emailVerificationRequiredAt: Date | null; onboardingStatus: string; businessType: string | null; profession: string | null; onboardingData: unknown; attribution: { firstTouchSource: string | null; lastTouchSource: string | null; referralSource: string | null } | null;
};

let cached: { expiresAt: number; value: AdminMetrics } | null = null;

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function sourceFrom(user: UserRow): string { return acquisitionSource(user); }
function within(date: Date | null, start: Date, days: number): boolean { return Boolean(date && date.getTime() >= start.getTime() && date.getTime() <= start.getTime() + days * 24 * 60 * 60 * 1000); }
function dayKey(date: Date): string { return date.toISOString().slice(0, 10); }
function pct(numerator: number, denominator: number): number | null { return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null; }
function addToMap(map: Map<string, number>, key: string, count = 1) { map.set(key, (map.get(key) || 0) + count); }
export type AdminMetrics = {
  definitionVersion: string;
  generatedAt: string;
  signups: { total: number; verified: number; last24h: number; last7d: number; daily: Array<{ day: string; count: number }> };
  qualification: { qualified: number; rate: number | null; sourceBreakdown: Array<{ source: string; signups: number; qualified: number }> };
  activation: { activated: number; rate: number | null; native: number; migration: number; portfolio: number; pathBreakdown: Array<{ path: string; count: number }> };
  deepActivation: { deeplyActivated: number; rateAmongActivated: number | null; averageModules: number; usersWithTwoActiveDays: number; connectedWorkflows: number };
  realData: { users: number; records: number };
  activeUsers: { wau: number; mau: number };
  retention: { available: boolean; numerator: number; denominator: number; rate: number | null; definition: string };
  workflowDepth: { averageModules: number; buckets: Array<{ label: string; count: number }> };
  reliability: { productEvents24h: number; failedEmails24h: number; queuedEmails: number };
};

export async function getAdminMetrics(force = false): Promise<AdminMetrics> {
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value;
  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: { accountType: "customer" },
    select: { id: true, email: true, name: true, createdAt: true, accountType: true, emailVerifiedAt: true, emailVerificationRequiredAt: true, onboardingStatus: true, businessType: true, profession: true, onboardingData: true, attribution: { select: { firstTouchSource: true, lastTouchSource: true, referralSource: true } } },
    orderBy: { createdAt: "asc" },
    take: 20_000,
  }) as UserRow[];
  const customerUsers = users.filter((user) => !INTERNAL_ACCOUNT_TYPES.has(user.accountType));
  const qualifiedUsers = customerUsers.filter((user) => isQualifiedUser(user));
  const effectiveVerifiedCount = customerUsers.filter((user) => !user.emailVerificationRequiredAt || Boolean(user.emailVerifiedAt)).length;
  const qualifiedIds = qualifiedUsers.map((user) => user.id);
  const customerIds = customerUsers.map((user) => user.id);
  const eventSince = customerUsers.reduce((earliest, user) => user.createdAt < earliest ? user.createdAt : earliest, ago30d);
  const [clients, projects, invoices, expenses, calendarEvents, importJobs, portfolios, events, productEvents24h, failedEmails24h, queuedEmails] = await Promise.all([
    prisma.client.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, createdAt: true } }).catch(() => [] as Array<{ id: string; userId: string; createdAt: Date }>),
    prisma.project.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, clientId: true, dueDate: true, createdAt: true } }),
    prisma.invoice.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, clientId: true, projectId: true, status: true, sentAt: true, createdAt: true } }),
    prisma.expense.findMany({ where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, projectId: true, createdAt: true } }),
    prisma.calendarEvent.findMany({ where: { userId: { in: customerIds }, deletedAt: null, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } }, select: { id: true, userId: true, clientId: true, projectId: true, invoiceId: true, dataOrigin: true, createdAt: true } }),
    prisma.importJob.findMany({ where: { userId: { in: customerIds }, status: { in: ["completed", "completed_with_issues"] } }, select: { userId: true, status: true, unresolvedCount: true, completedAt: true, createdAt: true, records: { select: { targetType: true } } } }),
    prisma.portfolio.findMany({ where: { userId: { in: customerIds }, status: "published", publishedAt: { not: null } }, select: { userId: true, publishedAt: true, content: true } }),
    // W1 and deep activation are cohort-relative; keep events back to the oldest
    // customer signup instead of silently dropping mature cohorts after 30 days.
    prisma.productEvent.findMany({ where: { userId: { in: customerIds }, occurredAt: { gte: eventSince } }, select: { userId: true, eventName: true, module: true, occurredAt: true, properties: true, entityId: true }, orderBy: { occurredAt: "asc" }, take: 200_000 }),
    prisma.productEvent.count({ where: { occurredAt: { gte: ago24h } } }),
    prisma.emailDelivery.count({ where: { status: { in: ["failed", "delivery_failed"] }, createdAt: { gte: ago24h } } }),
    prisma.emailOutbox.count({ where: { status: { in: ["queued", "processing"] } } }),
  ]);

  const clientsByUser = new Map<string, typeof clients>(); const projectsByUser = new Map<string, typeof projects>(); const invoicesByUser = new Map<string, typeof invoices>(); const expensesByUser = new Map<string, typeof expenses>(); const calendarByUser = new Map<string, typeof calendarEvents>(); const importsByUser = new Map<string, typeof importJobs>(); const portfoliosByUser = new Map<string, typeof portfolios>(); const eventsByUser = new Map<string, typeof events>();
  for (const row of clients) { if (!clientsByUser.has(row.userId)) clientsByUser.set(row.userId, []); clientsByUser.get(row.userId)!.push(row); }
  for (const row of projects) { if (!projectsByUser.has(row.userId)) projectsByUser.set(row.userId, []); projectsByUser.get(row.userId)!.push(row); }
  for (const row of invoices) { if (!invoicesByUser.has(row.userId)) invoicesByUser.set(row.userId, []); invoicesByUser.get(row.userId)!.push(row); }
  for (const row of expenses) { if (!expensesByUser.has(row.userId)) expensesByUser.set(row.userId, []); expensesByUser.get(row.userId)!.push(row); }
  for (const row of calendarEvents) { if (!calendarByUser.has(row.userId)) calendarByUser.set(row.userId, []); calendarByUser.get(row.userId)!.push(row); }
  for (const row of importJobs) { if (!importsByUser.has(row.userId)) importsByUser.set(row.userId, []); importsByUser.get(row.userId)!.push(row); }
  for (const row of portfolios) { if (!portfoliosByUser.has(row.userId)) portfoliosByUser.set(row.userId, []); portfoliosByUser.get(row.userId)!.push(row); }
  for (const row of events) { if (!row.userId) continue; if (!eventsByUser.has(row.userId)) eventsByUser.set(row.userId, []); eventsByUser.get(row.userId)!.push(row); }

  const pathCounts = new Map<string, number>(); const sourceSignup = new Map<string, number>(); const sourceQualified = new Map<string, number>(); const activationPath = new Map<string, number>();
  const activeWeek = new Set<string>(); const activeMonth = new Set<string>(); const moduleCounts: number[] = []; const activeDaysCounts: number[] = []; let nativeCount = 0; let migrationCount = 0; let portfolioCount = 0; let activated = 0; let deep = 0; let twoActiveDays = 0; let connected = 0; let realDataUsers = 0; let realDataRecords = 0;
  const retentionDenominatorUsers = qualifiedUsers.filter((user) => user.createdAt <= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)); let retentionNumerator = 0;

  for (const user of customerUsers) {
    const source = sourceFrom(user); addToMap(sourceSignup, source);
    const userEvents = eventsByUser.get(user.id) || [];
    const isQualified = qualifiedIds.includes(user.id);
    for (const event of userEvents) {
      if (isQualified && isMeaningfulProductEvent(event)) { if (event.occurredAt >= ago7d) activeWeek.add(user.id); if (event.occurredAt >= ago30d) activeMonth.add(user.id); }
      if (event.eventName === "page_viewed") { const props = isRecord(event.properties) ? event.properties : {}; const path = typeof props.path === "string" ? props.path : "/"; if (path.startsWith("/")) addToMap(pathCounts, path); }
    }
    if (isQualified && retentionDenominatorUsers.some((candidate) => candidate.id === user.id) && userEvents.some((event) => isMeaningfulProductEvent(event) && event.occurredAt >= new Date(user.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000) && event.occurredAt < new Date(user.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000))) retentionNumerator += 1;
    if (isQualified) addToMap(sourceQualified, source);
    const userClients = clientsByUser.get(user.id) || []; const userProjects = projectsByUser.get(user.id) || []; const userInvoices = invoicesByUser.get(user.id) || []; const userExpenses = expensesByUser.get(user.id) || []; const userCalendar = calendarByUser.get(user.id) || []; const userImports = importsByUser.get(user.id) || []; const userPortfolios = portfoliosByUser.get(user.id) || [];
    const realRecords = [...userClients, ...userProjects, ...userInvoices, ...userExpenses, ...userCalendar].filter((record) => within(record.createdAt, user.createdAt, 3650));
    if (realRecords.length) { realDataUsers += 1; realDataRecords += realRecords.length; }
    if (!isQualified) continue;
    const eligibleClients = userClients.filter((record) => within(record.createdAt, user.createdAt, 7));
    const eligibleProjects = userProjects.filter((record) => within(record.createdAt, user.createdAt, 7) && Boolean(record.clientId) && eligibleClients.some((client) => client.id === record.clientId));
    const connectedProjectIds = new Set(eligibleProjects.map((project) => project.id));
    const connectedClientIds = new Set(eligibleClients.map((client) => client.id));
    const nativeDeadline = eligibleProjects.some((project) => within(project.dueDate, user.createdAt, 7));
    const nativeOutcome = nativeDeadline || userInvoices.some((invoice) => within(invoice.createdAt, user.createdAt, 7) && (connectedProjectIds.has(invoice.projectId || "") || connectedClientIds.has(invoice.clientId || ""))) || userExpenses.some((expense) => within(expense.createdAt, user.createdAt, 7) && connectedProjectIds.has(expense.projectId || "")) || userCalendar.some((event) => within(event.createdAt, user.createdAt, 7) && (connectedProjectIds.has(event.projectId || "") || connectedClientIds.has(event.clientId || "")));
    const native = eligibleClients.length > 0 && eligibleProjects.length > 0 && nativeOutcome;
    const migration = userImports.some((job) => within(job.completedAt || job.createdAt, user.createdAt, 7) && job.unresolvedCount === 0 && new Set(job.records.map((record) => record.targetType)).size >= 2);
    const portfolio = userPortfolios.some((item) => {
      if (!within(item.publishedAt, user.createdAt, 7)) return false;
      const content = isRecord(item.content) ? item.content : {}; const contact = typeof content.contactEmail === "string" && Boolean(content.contactEmail.trim()); const realProjectIds = new Set(userProjects.map((project) => `project-${project.id}`)); const projectsInPortfolio = Array.isArray(content.projects) && content.projects.some((project) => isRecord(project) && typeof project.id === "string" && realProjectIds.has(project.id) && project.visibility !== "private" && typeof project.title === "string" && Boolean(project.title.trim()));
      return contact && projectsInPortfolio;
    });
    const isActivated = native || migration || portfolio;
    if (isActivated) { activated += 1; if (native) { nativeCount += 1; addToMap(activationPath, "native", 1); } if (migration) { migrationCount += 1; addToMap(activationPath, "migration", 1); } if (portfolio) { portfolioCount += 1; addToMap(activationPath, "portfolio", 1); } }
    const meaningful = userEvents.filter((event) => isMeaningfulProductEvent(event) && within(event.occurredAt, user.createdAt, 14));
    const modules = new Set(meaningful.map((event) => event.module || event.eventName)); const activeDays = new Set(meaningful.map((event) => dayKey(event.occurredAt))); const deepProjects = userProjects.filter((project) => within(project.createdAt, user.createdAt, 14)); const connectedWorkflow = deepProjects.some((project) => userInvoices.some((invoice) => within(invoice.createdAt, user.createdAt, 14) && invoice.projectId === project.id) || userExpenses.some((expense) => within(expense.createdAt, user.createdAt, 14) && expense.projectId === project.id) || userCalendar.some((event) => within(event.createdAt, user.createdAt, 14) && event.projectId === project.id));
    moduleCounts.push(modules.size); activeDaysCounts.push(activeDays.size); if (activeDays.size >= 2) twoActiveDays += 1; if (connectedWorkflow) connected += 1; if (isActivated && modules.size >= 3 && activeDays.size >= 2 && connectedWorkflow) deep += 1;
  }
  const sourceBreakdown = Array.from(new Set([...sourceSignup.keys(), ...sourceQualified.keys()])).map((source) => ({ source, signups: sourceSignup.get(source) || 0, qualified: sourceQualified.get(source) || 0 })).sort((a, b) => b.signups - a.signups);
  const daily: Array<{ day: string; count: number }> = []; for (let i = 13; i >= 0; i -= 1) { const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000); const key = dayKey(date); daily.push({ day: key, count: customerUsers.filter((user) => dayKey(user.createdAt) === key).length }); }
  const averageModules = moduleCounts.length ? Math.round((moduleCounts.reduce((sum, count) => sum + count, 0) / moduleCounts.length) * 10) / 10 : 0;
  const buckets = [{ label: "0–1 modules", count: moduleCounts.filter((count) => count <= 1).length }, { label: "2 modules", count: moduleCounts.filter((count) => count === 2).length }, { label: "3+ modules", count: moduleCounts.filter((count) => count >= 3).length }];
  const metrics: AdminMetrics = { definitionVersion: FUNNEL_DEFINITION_VERSION, generatedAt: now.toISOString(), signups: { total: customerUsers.length, verified: effectiveVerifiedCount, last24h: customerUsers.filter((user) => user.createdAt >= ago24h).length, last7d: customerUsers.filter((user) => user.createdAt >= ago7d).length, daily }, qualification: { qualified: qualifiedUsers.length, rate: pct(qualifiedUsers.length, customerUsers.length), sourceBreakdown }, activation: { activated, rate: pct(activated, qualifiedUsers.length), native: nativeCount, migration: migrationCount, portfolio: portfolioCount, pathBreakdown: Array.from(activationPath.entries()).map(([path, count]) => ({ path, count })) }, deepActivation: { deeplyActivated: deep, rateAmongActivated: pct(deep, activated), averageModules, usersWithTwoActiveDays: twoActiveDays, connectedWorkflows: connected }, realData: { users: realDataUsers, records: realDataRecords }, activeUsers: { wau: activeWeek.size, mau: activeMonth.size }, retention: { available: retentionDenominatorUsers.length > 0, numerator: retentionNumerator, denominator: retentionDenominatorUsers.length, rate: pct(retentionNumerator, retentionDenominatorUsers.length), definition: "Qualified users active in days 7–13 after signup, among cohorts at least 14 days old." }, workflowDepth: { averageModules, buckets }, reliability: { productEvents24h, failedEmails24h, queuedEmails } };
  cached = { expiresAt: Date.now() + 30_000, value: metrics };
  return metrics;
}

export function clearAdminMetricsCache() { cached = null; }
