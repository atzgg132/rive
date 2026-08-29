import "server-only";

import { PRODUCT_EVENT_NAMES, PRODUCT_EVENT_SCHEMA_VERSION, REAL_DATA_EVENT_NAMES } from "@/lib/analytics/eventContracts";
import { evaluateFunnelQuality, type FunnelQualityAlert } from "@/lib/analytics/funnelQuality";
import { prisma } from "@/utils/db";
import {
  acquisitionSource,
  ACTIVATION_WINDOW_DAYS,
  evaluateActivation,
  FUNNEL_DEFINITION_VERSION,
  INTERNAL_ACCOUNT_TYPES,
  isMeaningfulProductEvent,
  isQualifiedUser,
  qualificationBlockers,
  REAL_DATA_ORIGINS,
  withinDays,
} from "@/utils/funnelDefinitions";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  accountType: string;
  emailVerifiedAt: Date | null;
  emailVerificationRequiredAt: Date | null;
  onboardingStatus: string;
  businessType: string | null;
  profession: string | null;
  onboardingData: unknown;
  attribution: {
    firstTouchSource: string | null;
    lastTouchSource: string | null;
    referralSource: string | null;
  } | null;
};

type QualitySnapshot = {
  contractRejections24h: number;
  unknownEventNames24h: number;
  missingIdentityEvents24h: number;
  missingDataOriginEvents24h: number;
  unknownOriginRecords: number;
  latestEventAt: string | null;
  eventLagMinutes: number | null;
};

let cached: { expiresAt: number; value: AdminMetrics } | null = null;

function sourceFrom(user: UserRow): string {
  return acquisitionSource(user);
}

function within(date: Date | null, start: Date, days: number): boolean {
  return withinDays(date, start, days);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

function addToMap(map: Map<string, number>, key: string, count = 1): void {
  map.set(key, (map.get(key) || 0) + count);
}

export type AdminMetrics = {
  definitionVersion: string;
  generatedAt: string;
  signups: {
    total: number;
    verified: number;
    last24h: number;
    last7d: number;
    daily: Array<{ day: string; count: number }>;
  };
  qualification: {
    qualified: number;
    rate: number | null;
    sourceBreakdown: Array<{ source: string; signups: number; qualified: number }>;
  };
  activation: {
    activated: number;
    rate: number | null;
    native: number;
    migration: number;
    portfolio: number;
    pathBreakdown: Array<{ path: string; count: number }>;
  };
  deepActivation: {
    deeplyActivated: number;
    rateAmongActivated: number | null;
    averageModules: number;
    usersWithTwoActiveDays: number;
    connectedWorkflows: number;
  };
  realData: { users: number; records: number };
  activeUsers: { wau: number; mau: number };
  retention: {
    available: boolean;
    numerator: number;
    denominator: number;
    rate: number | null;
    definition: string;
  };
  workflowDepth: { averageModules: number; buckets: Array<{ label: string; count: number }> };
  reliability: { productEvents24h: number; failedEmails24h: number; queuedEmails: number };
  window: {
    label: "all_customer_accounts";
    signupSparklineDays: number;
    activationWindowDays: number;
    deepActivationWindowDays: number;
  };
  dropOff: {
    unqualified: number;
    qualifiedNotActivated: number;
    blockerCounts: Array<{ blocker: string; count: number }>;
  };
  quality: {
    schemaVersion: number;
    contractRejections24h: number;
    unknownEventNames24h: number;
    missingIdentityEvents24h: number;
    missingDataOriginEvents24h: number;
    unknownOriginRecords: number;
    latestEventAt: string | null;
    eventLagMinutes: number | null;
    uncapturedSignups: number;
    uncapturedSignupRate: number | null;
    alerts: FunnelQualityAlert[];
  };
};

export async function getAdminMetrics(force = false): Promise<AdminMetrics> {
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value;

  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const environment = (process.env.APP_ENV || process.env.NODE_ENV || "local").toLowerCase();

  const users = await prisma.user.findMany({
    where: { accountType: "customer" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      accountType: true,
      emailVerifiedAt: true,
      emailVerificationRequiredAt: true,
      onboardingStatus: true,
      businessType: true,
      profession: true,
      onboardingData: true,
      attribution: { select: { firstTouchSource: true, lastTouchSource: true, referralSource: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 20_000,
  }) as UserRow[];

  const customerUsers = users.filter((user) => !INTERNAL_ACCOUNT_TYPES.has(user.accountType));
  const qualifiedUsers = customerUsers.filter((user) => isQualifiedUser(user));
  const effectiveVerifiedCount = customerUsers.filter((user) => !user.emailVerificationRequiredAt || Boolean(user.emailVerifiedAt)).length;
  const qualifiedIdSet = new Set(qualifiedUsers.map((user) => user.id));
  const customerIds = customerUsers.map((user) => user.id);
  const eventSince = customerUsers.reduce((earliest, user) => user.createdAt < earliest ? user.createdAt : earliest, ago30d);

  const [
    clients,
    projects,
    invoices,
    expenses,
    calendarEvents,
    importJobs,
    portfolios,
    events,
    productEvents24h,
    failedEmails24h,
    queuedEmails,
    quality,
  ] = await Promise.all([
    prisma.client.findMany({
      where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } },
      select: { id: true, userId: true, createdAt: true },
    }),
    prisma.project.findMany({
      where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } },
      select: { id: true, userId: true, clientId: true, dueDate: true, createdAt: true },
    }),
    prisma.invoice.findMany({
      where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } },
      select: { id: true, userId: true, clientId: true, projectId: true, status: true, sentAt: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { userId: { in: customerIds }, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } },
      select: { id: true, userId: true, projectId: true, createdAt: true },
    }),
    prisma.calendarEvent.findMany({
      where: { userId: { in: customerIds }, deletedAt: null, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) } },
      select: { id: true, userId: true, clientId: true, projectId: true, invoiceId: true, dataOrigin: true, createdAt: true },
    }),
    prisma.importJob.findMany({
      where: { userId: { in: customerIds }, status: { in: ["completed", "completed_with_issues"] } },
      select: { userId: true, status: true, unresolvedCount: true, completedAt: true, createdAt: true, records: { select: { targetType: true } } },
    }),
    prisma.portfolio.findMany({
      where: { userId: { in: customerIds }, status: "published", publishedAt: { not: null } },
      select: { userId: true, publishedAt: true, content: true },
    }),
    // W1 and deep activation are cohort-relative; keep events back to the
    // oldest customer signup instead of silently dropping mature cohorts.
    prisma.productEvent.findMany({
      where: { environment, userId: { in: customerIds }, occurredAt: { gte: eventSince } },
      select: { userId: true, eventName: true, module: true, occurredAt: true, properties: true, entityId: true },
      orderBy: { occurredAt: "asc" },
      take: 200_000,
    }),
    prisma.productEvent.count({ where: { environment, occurredAt: { gte: ago24h } } }),
    prisma.emailDelivery.count({ where: { status: { in: ["failed", "delivery_failed"] }, createdAt: { gte: ago24h } } }),
    prisma.emailOutbox.count({ where: { status: { in: ["queued", "processing"] } } }),
    Promise.all([
      prisma.productEvent.findFirst({ where: { environment }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } }).catch(() => null),
      prisma.productEventIssue.count({ where: { environment, createdAt: { gte: ago24h } } }).catch(() => 0),
      prisma.productEvent.count({ where: { environment, occurredAt: { gte: ago24h }, eventName: { notIn: Array.from(PRODUCT_EVENT_NAMES) } } }).catch(() => 0),
      prisma.productEvent.count({ where: { environment, occurredAt: { gte: ago24h }, userId: null, anonymousId: null } }).catch(() => 0),
      prisma.productEvent.count({ where: { environment, occurredAt: { gte: ago24h }, eventName: { in: Array.from(REAL_DATA_EVENT_NAMES) }, dataOrigin: null } }).catch(() => 0),
      Promise.all([
        prisma.client.count({ where: { userId: { in: customerIds }, dataOrigin: null } }).catch(() => 0),
        prisma.project.count({ where: { userId: { in: customerIds }, dataOrigin: null } }).catch(() => 0),
        prisma.invoice.count({ where: { userId: { in: customerIds }, dataOrigin: null } }).catch(() => 0),
        prisma.expense.count({ where: { userId: { in: customerIds }, dataOrigin: null } }).catch(() => 0),
        prisma.calendarEvent.count({ where: { userId: { in: customerIds }, dataOrigin: null } }).catch(() => 0),
      ]),
    ]).then(([latestEvent, contractRejections24h, unknownEventNames24h, missingIdentityEvents24h, missingDataOriginEvents24h, unknownOriginCounts]) => ({
      latestEventAt: latestEvent?.occurredAt.toISOString() || null,
      eventLagMinutes: latestEvent ? Math.max(0, Math.round((now.getTime() - latestEvent.occurredAt.getTime()) / 60_000 * 10) / 10) : null,
      contractRejections24h,
      unknownEventNames24h,
      missingIdentityEvents24h,
      missingDataOriginEvents24h,
      unknownOriginRecords: unknownOriginCounts.reduce((sum, count) => sum + count, 0),
    } satisfies QualitySnapshot)).catch((): QualitySnapshot => ({
      latestEventAt: null,
      eventLagMinutes: null,
      contractRejections24h: 0,
      unknownEventNames24h: 0,
      missingIdentityEvents24h: 0,
      missingDataOriginEvents24h: 0,
      unknownOriginRecords: 0,
    })),
  ]);

  const clientsByUser = new Map<string, typeof clients>();
  const projectsByUser = new Map<string, typeof projects>();
  const invoicesByUser = new Map<string, typeof invoices>();
  const expensesByUser = new Map<string, typeof expenses>();
  const calendarByUser = new Map<string, typeof calendarEvents>();
  const importsByUser = new Map<string, typeof importJobs>();
  const portfoliosByUser = new Map<string, typeof portfolios>();
  const eventsByUser = new Map<string, typeof events>();

  for (const row of clients) { if (!clientsByUser.has(row.userId)) clientsByUser.set(row.userId, []); clientsByUser.get(row.userId)!.push(row); }
  for (const row of projects) { if (!projectsByUser.has(row.userId)) projectsByUser.set(row.userId, []); projectsByUser.get(row.userId)!.push(row); }
  for (const row of invoices) { if (!invoicesByUser.has(row.userId)) invoicesByUser.set(row.userId, []); invoicesByUser.get(row.userId)!.push(row); }
  for (const row of expenses) { if (!expensesByUser.has(row.userId)) expensesByUser.set(row.userId, []); expensesByUser.get(row.userId)!.push(row); }
  for (const row of calendarEvents) { if (!calendarByUser.has(row.userId)) calendarByUser.set(row.userId, []); calendarByUser.get(row.userId)!.push(row); }
  for (const row of importJobs) { if (!importsByUser.has(row.userId)) importsByUser.set(row.userId, []); importsByUser.get(row.userId)!.push(row); }
  for (const row of portfolios) { if (!portfoliosByUser.has(row.userId)) portfoliosByUser.set(row.userId, []); portfoliosByUser.get(row.userId)!.push(row); }
  for (const row of events) { if (!row.userId) continue; if (!eventsByUser.has(row.userId)) eventsByUser.set(row.userId, []); eventsByUser.get(row.userId)!.push(row); }

  const sourceSignup = new Map<string, number>();
  const sourceQualified = new Map<string, number>();
  const activationPath = new Map<string, number>();
  const blockerCounts = new Map<string, number>();
  const activeWeek = new Set<string>();
  const activeMonth = new Set<string>();
  const moduleCounts: number[] = [];
  let nativeCount = 0;
  let migrationCount = 0;
  let portfolioCount = 0;
  let activated = 0;
  let deep = 0;
  let twoActiveDays = 0;
  let connected = 0;
  let realDataUsers = 0;
  let realDataRecords = 0;
  let unqualified = 0;
  let qualifiedNotActivated = 0;
  const retentionDenominatorUsers = qualifiedUsers.filter((user) => user.createdAt <= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
  const retentionDenominatorIdSet = new Set(retentionDenominatorUsers.map((user) => user.id));
  let retentionNumerator = 0;

  for (const user of customerUsers) {
    const source = sourceFrom(user);
    addToMap(sourceSignup, source);
    const userEvents = eventsByUser.get(user.id) || [];
    const isQualified = qualifiedIdSet.has(user.id);

    for (const event of userEvents) {
      if (isQualified && isMeaningfulProductEvent(event)) {
        if (event.occurredAt >= ago7d) activeWeek.add(user.id);
        if (event.occurredAt >= ago30d) activeMonth.add(user.id);
      }
    }

    if (isQualified && retentionDenominatorIdSet.has(user.id)) {
      const retentionStart = new Date(user.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      const retentionEnd = new Date(user.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      if (userEvents.some((event) => isMeaningfulProductEvent(event) && event.occurredAt >= retentionStart && event.occurredAt < retentionEnd)) retentionNumerator += 1;
    }

    if (isQualified) addToMap(sourceQualified, source);

    const userClients = clientsByUser.get(user.id) || [];
    const userProjects = projectsByUser.get(user.id) || [];
    const userInvoices = invoicesByUser.get(user.id) || [];
    const userExpenses = expensesByUser.get(user.id) || [];
    const userCalendar = calendarByUser.get(user.id) || [];
    const userImports = importsByUser.get(user.id) || [];
    const userPortfolios = portfoliosByUser.get(user.id) || [];
    const realRecords = [...userClients, ...userProjects, ...userInvoices, ...userExpenses, ...userCalendar].filter((record) => within(record.createdAt, user.createdAt, 3650));
    if (realRecords.length) { realDataUsers += 1; realDataRecords += realRecords.length; }
    const activation = evaluateActivation({
      signupAt: user.createdAt,
      clients: userClients,
      projects: userProjects,
      invoices: userInvoices,
      expenses: userExpenses,
      calendarEvents: userCalendar,
      importJobs: userImports,
      portfolios: userPortfolios,
    });
    if (!isQualified) {
      unqualified += 1;
      for (const blocker of qualificationBlockers(user)) addToMap(blockerCounts, `qualification:${blocker}`);
      continue;
    }

    const isActivated = activation.activated;
    if (isActivated) {
      activated += 1;
      if (activation.native) { nativeCount += 1; addToMap(activationPath, "native"); }
      if (activation.migration) { migrationCount += 1; addToMap(activationPath, "migration"); }
      if (activation.portfolio) { portfolioCount += 1; addToMap(activationPath, "portfolio"); }
    } else {
      qualifiedNotActivated += 1;
      for (const blocker of activation.blockers) addToMap(blockerCounts, `activation:${blocker}`);
    }

    const meaningful = userEvents.filter((event) => isMeaningfulProductEvent(event) && within(event.occurredAt, user.createdAt, 14));
    const modules = new Set(meaningful.map((event) => event.module || event.eventName));
    const activeDays = new Set(meaningful.map((event) => dayKey(event.occurredAt)));
    const deepProjects = userProjects.filter((project) => within(project.createdAt, user.createdAt, 14));
    const connectedWorkflow = deepProjects.some((project) => userInvoices.some((invoice) => within(invoice.createdAt, user.createdAt, 14) && invoice.projectId === project.id) || userExpenses.some((expense) => within(expense.createdAt, user.createdAt, 14) && expense.projectId === project.id) || userCalendar.some((event) => within(event.createdAt, user.createdAt, 14) && event.projectId === project.id));
    moduleCounts.push(modules.size);
    if (activeDays.size >= 2) twoActiveDays += 1;
    if (connectedWorkflow) connected += 1;
    if (isActivated && modules.size >= 3 && activeDays.size >= 2 && connectedWorkflow) deep += 1;
  }

  const sourceBreakdown = Array.from(new Set([...sourceSignup.keys(), ...sourceQualified.keys()]))
    .map((source) => ({ source, signups: sourceSignup.get(source) || 0, qualified: sourceQualified.get(source) || 0 }))
    .sort((a, b) => b.signups - a.signups);
  const daily: Array<{ day: string; count: number }> = [];
  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = dayKey(date);
    daily.push({ day: key, count: customerUsers.filter((user) => dayKey(user.createdAt) === key).length });
  }
  const averageModules = moduleCounts.length ? Math.round((moduleCounts.reduce((sum, count) => sum + count, 0) / moduleCounts.length) * 10) / 10 : 0;
  const buckets = [
    { label: "0–1 modules", count: moduleCounts.filter((count) => count <= 1).length },
    { label: "2 modules", count: moduleCounts.filter((count) => count === 2).length },
    { label: "3+ modules", count: moduleCounts.filter((count) => count >= 3).length },
  ];
  const uncapturedSignups = customerUsers.filter((user) => sourceFrom(user) === "uncaptured").length;

  const qualityData = {
    ...quality,
    schemaVersion: PRODUCT_EVENT_SCHEMA_VERSION,
    uncapturedSignups,
    uncapturedSignupRate: pct(uncapturedSignups, customerUsers.length),
  };
  const metrics: AdminMetrics = {
    definitionVersion: FUNNEL_DEFINITION_VERSION,
    generatedAt: now.toISOString(),
    signups: {
      total: customerUsers.length,
      verified: effectiveVerifiedCount,
      last24h: customerUsers.filter((user) => user.createdAt >= ago24h).length,
      last7d: customerUsers.filter((user) => user.createdAt >= ago7d).length,
      daily,
    },
    qualification: { qualified: qualifiedUsers.length, rate: pct(qualifiedUsers.length, customerUsers.length), sourceBreakdown },
    activation: { activated, rate: pct(activated, qualifiedUsers.length), native: nativeCount, migration: migrationCount, portfolio: portfolioCount, pathBreakdown: Array.from(activationPath.entries()).map(([path, count]) => ({ path, count })) },
    deepActivation: { deeplyActivated: deep, rateAmongActivated: pct(deep, activated), averageModules, usersWithTwoActiveDays: twoActiveDays, connectedWorkflows: connected },
    realData: { users: realDataUsers, records: realDataRecords },
    activeUsers: { wau: activeWeek.size, mau: activeMonth.size },
    retention: { available: retentionDenominatorUsers.length > 0, numerator: retentionNumerator, denominator: retentionDenominatorUsers.length, rate: pct(retentionNumerator, retentionDenominatorUsers.length), definition: "Qualified users active in days 7–13 after signup, among cohorts at least 14 days old." },
    workflowDepth: { averageModules, buckets },
    reliability: { productEvents24h, failedEmails24h, queuedEmails },
    window: {
      label: "all_customer_accounts",
      signupSparklineDays: 14,
      activationWindowDays: ACTIVATION_WINDOW_DAYS,
      deepActivationWindowDays: 14,
    },
    dropOff: {
      unqualified,
      qualifiedNotActivated,
      blockerCounts: Array.from(blockerCounts.entries()).map(([blocker, count]) => ({ blocker, count })).sort((a, b) => b.count - a.count),
    },
    quality: {
      ...qualityData,
      alerts: evaluateFunnelQuality({
        signups: { total: customerUsers.length, last24h: customerUsers.filter((user) => user.createdAt >= ago24h).length, last7d: customerUsers.filter((user) => user.createdAt >= ago7d).length },
        reliability: { productEvents24h, failedEmails24h, queuedEmails },
        quality: qualityData,
      }),
    },
  };

  cached = { expiresAt: Date.now() + 30_000, value: metrics };
  return metrics;
}

export function clearAdminMetricsCache(): void {
  cached = null;
}
