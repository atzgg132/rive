import { checkServerIdentity } from "node:tls";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import {
  evaluateActivation,
  hasRealDataRecords,
  qualificationBlockers,
  REAL_DATA_ORIGINS,
  summarizeFunnelUser,
} from "../src/utils/funnelDefinitions.ts";

const args = process.argv.slice(2);
const emailArg = args.find((argument) => argument.startsWith("--email="))?.slice("--email=".length) || args[args.indexOf("--email") + 1];
const help = args.includes("--help") || args.includes("-h");

if (help || !emailArg) {
  console.log("Usage: node --experimental-strip-types --env-file=.env.local scripts/diagnose-funnel-user.mjs --email=user@example.com");
  console.log("Read-only. Prints funnel gates for one account. Never prints tokens, hashes, or invoice contents.");
  process.exit(help ? 0 : 1);
}

const email = emailArg.trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
const parsedConnectionString = new URL(databaseUrl);
for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsedConnectionString.searchParams.delete(parameter);
const pool = new Pool({
  connectionString: parsedConnectionString.toString(),
  ssl: process.env.DATABASE_SSL === "disable" || databaseUrl.includes("sslmode=disable")
    ? false
    : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true", ...(sslServerName ? { checkServerIdentity: (_hostname, certificate) => checkServerIdentity(sslServerName, certificate) } : {}) },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const origins = Array.from(REAL_DATA_ORIGINS);

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
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
  });
  if (!user) {
    console.log(JSON.stringify({ email, found: false }, null, 2));
    process.exit(1);
  }

  const [clients, projects, invoices, expenses, calendarEvents, importJobs, portfolios, events] = await Promise.all([
    prisma.client.findMany({ where: { userId: user.id }, select: { id: true, createdAt: true, dataOrigin: true } }),
    prisma.project.findMany({ where: { userId: user.id }, select: { id: true, clientId: true, dueDate: true, createdAt: true, dataOrigin: true } }),
    prisma.invoice.findMany({ where: { userId: user.id }, select: { projectId: true, clientId: true, createdAt: true, dataOrigin: true } }),
    prisma.expense.findMany({ where: { userId: user.id }, select: { projectId: true, createdAt: true, dataOrigin: true } }),
    prisma.calendarEvent.findMany({ where: { userId: user.id, deletedAt: null }, select: { projectId: true, clientId: true, createdAt: true, dataOrigin: true } }),
    prisma.importJob.findMany({
      where: { userId: user.id, status: { in: ["completed", "completed_with_issues"] } },
      select: { completedAt: true, createdAt: true, unresolvedCount: true, records: { select: { targetType: true } } },
    }),
    prisma.portfolio.findMany({ where: { userId: user.id }, select: { status: true, publishedAt: true, content: true } }),
    prisma.productEvent.findMany({
      where: { userId: user.id },
      orderBy: { occurredAt: "desc" },
      take: 10,
      select: { eventName: true, occurredAt: true, environment: true, module: true },
    }),
  ]);

  const real = {
    clients: clients.filter((row) => row.dataOrigin && origins.includes(row.dataOrigin)),
    projects: projects.filter((row) => row.dataOrigin && origins.includes(row.dataOrigin)),
    invoices: invoices.filter((row) => row.dataOrigin && origins.includes(row.dataOrigin)),
    expenses: expenses.filter((row) => row.dataOrigin && origins.includes(row.dataOrigin)),
    calendarEvents: calendarEvents.filter((row) => row.dataOrigin && origins.includes(row.dataOrigin)),
  };
  const activation = evaluateActivation({
    signupAt: user.createdAt,
    clients: real.clients,
    projects: real.projects,
    invoices: real.invoices,
    expenses: real.expenses,
    calendarEvents: real.calendarEvents,
    importJobs,
    portfolios: portfolios.filter((item) => item.status === "published" && item.publishedAt),
  });
  const counts = {
    clients: real.clients.length,
    projects: real.projects.length,
    invoices: real.invoices.length,
    expenses: real.expenses.length,
    calendarEvents: real.calendarEvents.length,
  };
  const summary = summarizeFunnelUser({ user, activation, realData: hasRealDataRecords(counts) });

  console.log(JSON.stringify({
    found: true,
    email: user.email,
    id: user.id,
    createdAt: user.createdAt,
    accountType: user.accountType,
    onboardingStatus: user.onboardingStatus,
    businessType: user.businessType,
    profession: user.profession,
    onboardingData: user.onboardingData,
    attribution: user.attribution,
    qualificationBlockers: qualificationBlockers(user),
    summary,
    activation,
    workspace: {
      ...counts,
      publishedPortfolios: portfolios.filter((item) => item.status === "published").length,
      unknownOrigin: {
        clients: clients.filter((row) => !row.dataOrigin).length,
        projects: projects.filter((row) => !row.dataOrigin).length,
        invoices: invoices.filter((row) => !row.dataOrigin).length,
        expenses: expenses.filter((row) => !row.dataOrigin).length,
        calendarEvents: calendarEvents.filter((row) => !row.dataOrigin).length,
      },
    },
    recentEvents: events,
  }, null, 2));
} finally {
  await prisma.$disconnect();
  await pool.end();
}
