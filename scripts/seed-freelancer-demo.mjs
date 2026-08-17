import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const emailArgument = process.argv.find((argument) => argument.startsWith("--email="));
const targetEmail = emailArgument?.slice("--email=".length).trim().toLowerCase();
const shouldApply = process.argv.includes("--apply");

if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
  throw new Error("Pass a valid target with --email=user@example.com.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

/* This script writes synthetic clients, invoices, enquiries, and traffic onto a
   real account. That is exactly what a development showcase needs and exactly
   what production must never contain, so the environment is checked rather than
   trusted to the person typing the command. */
if (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production") {
  throw new Error("The freelancer demo seed writes synthetic data and must never run against production.");
}

const connectionString = process.env.DATABASE_URL
  .replace(/([?&])channel_binding=[^&]*/g, "$1")
  .replace(/[?&]$/, "");
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function stableUuid(key) {
  const hex = crypto.createHash("sha256").update(`rive-freelancer-demo:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function at(value) {
  return new Date(value);
}

function mergeById(existing, additions) {
  const additionIds = new Set(additions.map((item) => item.id));
  return [...additions, ...existing.filter((item) => !additionIds.has(item?.id))];
}

function portfolioContent(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    name: typeof input.name === "string" ? input.name : "Arnav Bhattacharya",
    profileImageUrl: typeof input.profileImageUrl === "string" ? input.profileImageUrl : "",
    headline: typeof input.headline === "string" ? input.headline : "",
    bio: typeof input.bio === "string" ? input.bio : "",
    location: typeof input.location === "string" ? input.location : "",
    availability: typeof input.availability === "string" ? input.availability : "",
    contactEmail: typeof input.contactEmail === "string" ? input.contactEmail : "",
    social: Array.isArray(input.social) ? input.social : [],
    projects: Array.isArray(input.projects) ? input.projects : [],
    services: Array.isArray(input.services) ? input.services : [],
    testimonials: Array.isArray(input.testimonials) ? input.testimonials : [],
    sections: Array.isArray(input.sections) ? input.sections : [],
  };
}

async function snapshot(userId) {
  const [
    clients,
    projects,
    milestones,
    tasks,
    invoices,
    invoiceItems,
    expenses,
    calendars,
    calendarEvents,
    portfolio,
  ] = await Promise.all([
    prisma.client.count({ where: { userId } }),
    prisma.project.count({ where: { userId } }),
    prisma.milestone.count({ where: { project: { userId } } }),
    prisma.task.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId } }),
    prisma.invoiceItem.count({ where: { invoice: { userId } } }),
    prisma.expense.count({ where: { userId } }),
    prisma.calendar.count({ where: { userId } }),
    prisma.calendarEvent.count({ where: { userId, deletedAt: null } }),
    prisma.portfolio.findUnique({
      where: { userId },
      select: {
        id: true,
        slug: true,
        status: true,
        content: true,
        views: { select: { id: true, pageType: true } },
        inquiries: { select: { id: true, status: true } },
      },
    }),
  ]);
  const content = portfolio ? portfolioContent(portfolio.content) : null;
  return {
    clients,
    projects,
    milestones,
    tasks,
    invoices,
    invoiceItems,
    expenses,
    calendars,
    calendarEvents,
    portfolio: portfolio
      ? {
          slug: portfolio.slug,
          status: portfolio.status,
          projects: content.projects.length,
          services: content.services.length,
          testimonials: content.testimonials.length,
          views: portfolio.views.length,
          portfolioViews: portfolio.views.filter((view) => view.pageType === "portfolio").length,
          projectViews: portfolio.views.filter((view) => view.pageType === "project").length,
          inquiries: portfolio.inquiries.length,
          inquiriesByStatus: portfolio.inquiries.reduce(
            (counts, inquiry) => ({ ...counts, [inquiry.status]: (counts[inquiry.status] || 0) + 1 }),
            {},
          ),
        }
      : null,
  };
}

const clients = [
  {
    key: "northstar",
    name: "Maya Rao",
    email: "maya@northstarlabs.example",
    phone: "+91 98765 41021",
    company: "Northstar Labs",
    website: "https://northstarlabs.example",
    address: "Bengaluru, Karnataka",
    avatarColor: "#2563EB",
    tags: ["SaaS", "website", "retainer"],
    status: "active",
    notes: "Synthetic demo client. Product-led SaaS team; prefers concise weekly updates and Friday reviews.",
    createdAt: at("2026-03-03T09:30:00+05:30"),
  },
  {
    key: "finpilot",
    name: "Kabir Mehta",
    email: "kabir@finpilot.example",
    phone: "+91 98765 41022",
    company: "FinPilot",
    website: "https://finpilot.example",
    address: "Mumbai, Maharashtra",
    avatarColor: "#7C3AED",
    tags: ["fintech", "product design", "dashboard"],
    status: "active",
    notes: "Synthetic demo client. Early-stage fintech product focused on trust, activation, and clear financial UX.",
    createdAt: at("2026-04-08T11:00:00+05:30"),
  },
  {
    key: "katha",
    name: "Ananya Sen",
    email: "ananya@studiokatha.example",
    phone: "+91 98765 41023",
    company: "Studio Katha",
    website: "https://studiokatha.example",
    address: "Kolkata, West Bengal",
    avatarColor: "#DB2777",
    tags: ["creative studio", "booking", "web development"],
    status: "active",
    notes: "Synthetic demo client. Boutique creative studio; current engagement covers a responsive booking website and CMS.",
    createdAt: at("2026-06-02T10:15:00+05:30"),
  },
  {
    key: "foundry",
    name: "Rohan Iyer",
    email: "rohan@foundryworks.example",
    phone: "+91 98765 41024",
    company: "Foundry Works",
    website: "https://foundryworks.example",
    address: "Hyderabad, Telangana",
    avatarColor: "#059669",
    tags: ["B2B", "design system", "frontend"],
    status: "lead",
    notes: "Synthetic demo client. Discovery completed; phase one proposal covers a reusable product design system.",
    createdAt: at("2026-07-10T14:00:00+05:30"),
  },
];

const projects = [
  {
    key: "rive",
    clientKey: null,
    title: "rive. — freelance operating system",
    description: "Designing and building the core product experience for a connected freelancer OS spanning clients, projects, revenue, expenses, calendar, onboarding, and public portfolios.",
    status: "active",
    priority: "high",
    startDate: at("2026-03-01T00:00:00Z"),
    dueDate: at("2026-08-15T12:00:00+05:30"),
    budget: 0,
    tags: ["Next.js", "product design", "full-stack", "PostgreSQL", "SaaS"],
    createdAt: at("2026-03-01T09:00:00+05:30"),
  },
  {
    key: "northstar-site",
    clientKey: "northstar",
    title: "Northstar Labs marketing site",
    description: "Repositioned a technical SaaS product through a conversion-focused website, responsive design system, CMS-ready components, and performance optimization.",
    status: "completed",
    priority: "high",
    startDate: at("2026-03-05T12:00:00+05:30"),
    dueDate: at("2026-04-24T18:00:00+05:30"),
    budget: 1850,
    tags: ["web design", "Next.js", "responsive", "SEO"],
    createdAt: at("2026-03-03T10:00:00+05:30"),
  },
  {
    key: "finpilot-onboarding",
    clientKey: "finpilot",
    title: "FinPilot onboarding & analytics",
    description: "Redesigned onboarding and the financial analytics dashboard to make activation faster, metrics easier to trust, and empty states more actionable.",
    status: "completed",
    priority: "high",
    startDate: at("2026-04-12T12:00:00+05:30"),
    dueDate: at("2026-06-14T18:00:00+05:30"),
    budget: 2400,
    tags: ["product design", "dashboard", "UX research", "React"],
    createdAt: at("2026-04-08T12:00:00+05:30"),
  },
  {
    key: "katha-booking",
    clientKey: "katha",
    title: "Studio Katha booking platform",
    description: "A responsive portfolio and booking experience that turns enquiries into structured briefs and gives the studio a maintainable project showcase.",
    status: "active",
    priority: "urgent",
    startDate: at("2026-06-08T12:00:00+05:30"),
    dueDate: at("2026-08-08T18:00:00+05:30"),
    budget: 1650,
    tags: ["web development", "CMS", "booking flow", "accessibility"],
    createdAt: at("2026-06-02T11:00:00+05:30"),
  },
  {
    key: "foundry-system",
    clientKey: "foundry",
    title: "Foundry Works product design system",
    description: "Auditing fragmented product UI and defining reusable tokens, components, documentation, and an implementation roadmap.",
    status: "active",
    priority: "medium",
    startDate: at("2026-07-15T12:00:00+05:30"),
    dueDate: at("2026-09-05T18:00:00+05:30"),
    budget: 1350,
    tags: ["design system", "Figma", "frontend architecture"],
    createdAt: at("2026-07-10T15:00:00+05:30"),
  },
];

const milestoneDefinitions = [
  ["northstar-discovery", "northstar-site", "Discovery & information architecture approved", "2026-03-14T12:00:00+05:30", true, "2026-03-13T16:00:00+05:30"],
  ["northstar-design", "northstar-site", "Responsive visual system signed off", "2026-03-30T12:00:00+05:30", true, "2026-03-29T18:00:00+05:30"],
  ["northstar-launch", "northstar-site", "Production launch & handoff", "2026-04-24T18:00:00+05:30", true, "2026-04-24T16:30:00+05:30"],
  ["finpilot-research", "finpilot-onboarding", "Activation research synthesis", "2026-04-24T12:00:00+05:30", true, "2026-04-23T17:00:00+05:30"],
  ["finpilot-prototype", "finpilot-onboarding", "Interactive prototype approved", "2026-05-18T12:00:00+05:30", true, "2026-05-17T18:00:00+05:30"],
  ["finpilot-release", "finpilot-onboarding", "Dashboard release & measurement plan", "2026-06-14T18:00:00+05:30", true, "2026-06-14T15:00:00+05:30"],
  ["katha-cms", "katha-booking", "CMS content migration", "2026-08-01T18:00:00+05:30", false, null],
  ["katha-qa", "katha-booking", "Mobile QA and booking-flow sign-off", "2026-08-06T18:00:00+05:30", false, null],
  ["rive-calendar", "rive", "Connected calendar beta", "2026-07-24T18:00:00+05:30", true, "2026-07-24T17:30:00+05:30"],
  ["rive-onboarding", "rive", "Guided onboarding & import release", "2026-08-12T18:00:00+05:30", false, null],
  ["foundry-audit", "foundry-system", "UI inventory and token audit", "2026-08-14T18:00:00+05:30", false, null],
];

const taskDefinitions = [
  ["northstar-copy", "northstar-site", "northstar-design", "Finalize conversion copy hierarchy", "done", "high", "2026-03-25T18:00:00+05:30", null, null, 240, true, "2026-03-25T17:20:00+05:30"],
  ["finpilot-testing", "finpilot-onboarding", "finpilot-prototype", "Run moderated onboarding usability tests", "done", "high", "2026-05-12T18:00:00+05:30", null, null, 360, true, "2026-05-12T16:00:00+05:30"],
  ["rive-analytics", "rive", "rive-onboarding", "Connect onboarding activation insights", "in_progress", "high", "2026-07-31T18:00:00+05:30", "2026-07-29T10:00:00+05:30", "2026-07-29T12:30:00+05:30", 150, false, null],
  ["katha-responsive", "katha-booking", "katha-cms", "Complete responsive booking-flow QA", "in_progress", "urgent", "2026-08-01T18:00:00+05:30", "2026-07-30T14:00:00+05:30", "2026-07-30T17:00:00+05:30", 180, true, null],
  ["katha-handoff", "katha-booking", "katha-qa", "Prepare CMS handoff and editor guide", "todo", "high", "2026-08-05T18:00:00+05:30", "2026-08-04T11:00:00+05:30", "2026-08-04T13:00:00+05:30", 120, true, null],
  ["foundry-tokens", "foundry-system", "foundry-audit", "Map typography, spacing, and color tokens", "todo", "medium", "2026-08-10T18:00:00+05:30", null, null, 300, true, null],
  ["rive-mobile", "rive", "rive-onboarding", "Audit mobile onboarding and portfolio flows", "todo", "high", "2026-08-03T18:00:00+05:30", "2026-08-03T10:00:00+05:30", "2026-08-03T12:00:00+05:30", 120, false, null],
];

const invoiceDefinitions = [
  ["RIVE-2026-001", "northstar", "northstar-site", "paid", 1200, "2026-03-05T12:00:00+05:30", "2026-03-19T18:00:00+05:30", "2026-03-16T15:00:00+05:30", "Website strategy, UX and visual direction"],
  ["RIVE-2026-002", "northstar", "northstar-site", "paid", 650, "2026-04-10T12:00:00+05:30", "2026-04-24T18:00:00+05:30", "2026-04-22T12:00:00+05:30", "Frontend implementation, QA and launch"],
  ["RIVE-2026-003", "finpilot", "finpilot-onboarding", "paid", 1400, "2026-05-02T12:00:00+05:30", "2026-05-16T18:00:00+05:30", "2026-05-14T16:00:00+05:30", "Research, journey mapping and onboarding redesign"],
  ["RIVE-2026-004", "finpilot", "finpilot-onboarding", "paid", 1000, "2026-06-05T12:00:00+05:30", "2026-06-19T18:00:00+05:30", "2026-06-18T13:00:00+05:30", "Analytics dashboard design and developer handoff"],
  ["RIVE-2026-005", "katha", "katha-booking", "paid", 825, "2026-07-01T12:00:00+05:30", "2026-07-10T18:00:00+05:30", "2026-07-09T17:00:00+05:30", "Booking platform discovery and design deposit"],
  ["RIVE-2026-006", "katha", "katha-booking", "sent", 825, "2026-07-22T12:00:00+05:30", "2026-08-05T18:00:00+05:30", null, "Frontend delivery, CMS setup and launch"],
  ["RIVE-2026-007", "foundry", "foundry-system", "overdue", 450, "2026-07-01T12:00:00+05:30", "2026-07-15T18:00:00+05:30", null, "Product UI audit and design-system discovery"],
  ["RIVE-2026-008", "foundry", "foundry-system", "draft", 900, "2026-07-26T12:00:00+05:30", "2026-08-16T18:00:00+05:30", null, "Token architecture, core components and documentation"],
];

const expenseDefinitions = [
  ["figma-mar", "software", "Figma Professional", 13.5, "2026-03-03T12:00:00+05:30", null, false],
  ["vercel-mar", "hosting", "Vercel project hosting", 16.5, "2026-03-08T12:00:00+05:30", "northstar-site", true],
  ["domain-rive", "hosting", "rive.work domain and DNS", 22, "2026-03-12T12:00:00+05:30", "rive", false],
  ["research-apr", "software", "User research transcription tools", 28, "2026-04-18T12:00:00+05:30", "finpilot-onboarding", true],
  ["travel-apr", "travel", "Client workshop travel — FinPilot", 62, "2026-04-21T12:00:00+05:30", "finpilot-onboarding", true],
  ["fonts-may", "assets", "Licensed typeface for Northstar launch", 45, "2026-05-04T12:00:00+05:30", "northstar-site", true],
  ["cloud-may", "hosting", "Database and object storage", 31, "2026-05-15T12:00:00+05:30", "rive", false],
  ["cowork-jun", "office", "Coworking day passes", 72, "2026-06-11T12:00:00+05:30", null, false],
  ["camera-jun", "equipment", "Webcam and client-call lighting", 98, "2026-06-19T12:00:00+05:30", null, false],
  ["cms-jul", "software", "Headless CMS development plan", 34, "2026-07-04T12:00:00+05:30", "katha-booking", true],
  ["travel-jul", "travel", "Studio Katha discovery workshop", 58, "2026-07-07T12:00:00+05:30", "katha-booking", true],
  ["cloud-jul", "hosting", "Production hosting and monitoring", 42, "2026-07-20T12:00:00+05:30", "rive", false],
];

const calendarEventDefinitions = [
  ["weekly-planning", "Weekly freelance planning", "Review delivery priorities, receivables, and protected focus blocks.", "2026-07-27T09:30:00+05:30", "2026-07-27T10:00:00+05:30", null, null, null],
  ["katha-review", "Studio Katha — responsive review", "Review booking flow on mobile and agree the final QA list.", "2026-07-29T16:00:00+05:30", "2026-07-29T16:45:00+05:30", "katha", "katha-booking", "https://meet.google.com/demo-katha"],
  ["rive-focus", "Rive product focus block", "Protected build time for onboarding activation and portfolio polish.", "2026-07-30T09:30:00+05:30", "2026-07-30T12:30:00+05:30", null, "rive", null],
  ["foundry-workshop", "Foundry Works — token workshop", "Align on design principles, naming, and the first component tranche.", "2026-07-31T15:00:00+05:30", "2026-07-31T16:00:00+05:30", "foundry", "foundry-system", "https://meet.google.com/demo-foundry"],
  ["finance-review", "Monthly finance & pipeline review", "Reconcile expenses, follow up overdue invoices, and plan August capacity.", "2026-08-01T10:00:00+05:30", "2026-08-01T11:00:00+05:30", null, null, null],
];

async function seed(user) {
  const clientIds = Object.fromEntries(clients.map((client) => [client.key, stableUuid(`client:${client.key}`)]));
  const projectIds = Object.fromEntries(projects.map((project) => [project.key, stableUuid(`project:${project.key}`)]));
  const milestoneIds = Object.fromEntries(milestoneDefinitions.map(([key]) => [key, stableUuid(`milestone:${key}`)]));
  const portfolioId = user.portfolio?.id || stableUuid(`portfolio:${user.id}`);
  const calendarId = user.calendars[0]?.id || stableUuid(`calendar:${user.id}`);

  await prisma.$transaction(async (transaction) => {
    const existingOnboarding = user.onboardingData && typeof user.onboardingData === "object" && !Array.isArray(user.onboardingData)
      ? user.onboardingData
      : {};
    await transaction.user.update({
      where: { id: user.id },
      data: {
        name: "Arnav Bhattacharya",
        businessType: "freelancer",
        profession: "Web developer & product designer",
        currency: "USD",
        timeZone: "Asia/Kolkata",
        onboardingStatus: "complete",
        onboardingStep: 5,
        onboardingData: {
          ...existingOnboarding,
          goal: "organize",
          demoPersona: "Web development and product design freelancer building rive.",
          experienceStartedAt: "2026-03-01",
        },
      },
    });

    for (const client of clients) {
      const clientData = { ...client };
      delete clientData.key;
      await transaction.client.upsert({
        where: { id: clientIds[client.key] },
        create: { id: clientIds[client.key], userId: user.id, ...clientData },
        update: {
          name: client.name,
          email: client.email,
          phone: client.phone,
          company: client.company,
          website: client.website,
          address: client.address,
          avatarColor: client.avatarColor,
          tags: client.tags,
          status: client.status,
          notes: client.notes,
        },
      });
    }

    for (const project of projects) {
      const clientId = project.clientKey ? clientIds[project.clientKey] : null;
      await transaction.project.upsert({
        where: { id: projectIds[project.key] },
        create: {
          id: projectIds[project.key],
          userId: user.id,
          clientId,
          title: project.title,
          description: project.description,
          status: project.status,
          priority: project.priority,
          startDate: project.startDate,
          dueDate: project.dueDate,
          budget: project.budget,
          currency: "USD",
          tags: project.tags,
          createdAt: project.createdAt,
        },
        update: {
          clientId,
          title: project.title,
          description: project.description,
          status: project.status,
          priority: project.priority,
          startDate: project.startDate,
          dueDate: project.dueDate,
          budget: project.budget,
          currency: "USD",
          tags: project.tags,
        },
      });
    }

    for (const [key, projectKey, title, dueDate, completed, completedAt] of milestoneDefinitions) {
      await transaction.milestone.upsert({
        where: { id: milestoneIds[key] },
        create: {
          id: milestoneIds[key],
          projectId: projectIds[projectKey],
          title,
          dueDate: at(dueDate),
          completed,
          completedAt: completedAt ? at(completedAt) : null,
          createdAt: projects.find((project) => project.key === projectKey).createdAt,
        },
        update: { title, dueDate: at(dueDate), completed, completedAt: completedAt ? at(completedAt) : null },
      });
    }

    for (const [key, projectKey, milestoneKey, title, status, priority, dueDate, scheduledStartAt, scheduledEndAt, estimatedMinutes, billable, completedAt] of taskDefinitions) {
      await transaction.task.upsert({
        where: { id: stableUuid(`task:${key}`) },
        create: {
          id: stableUuid(`task:${key}`),
          userId: user.id,
          projectId: projectIds[projectKey],
          milestoneId: milestoneIds[milestoneKey],
          title,
          description: `Synthetic demo task linked to ${projects.find((project) => project.key === projectKey).title}.`,
          status,
          priority,
          dueDate: at(dueDate),
          scheduledStartAt: scheduledStartAt ? at(scheduledStartAt) : null,
          scheduledEndAt: scheduledEndAt ? at(scheduledEndAt) : null,
          timeZone: "Asia/Kolkata",
          estimatedMinutes,
          billable,
          completedAt: completedAt ? at(completedAt) : null,
          createdAt: projects.find((project) => project.key === projectKey).createdAt,
        },
        update: {
          projectId: projectIds[projectKey],
          milestoneId: milestoneIds[milestoneKey],
          title,
          status,
          priority,
          dueDate: at(dueDate),
          scheduledStartAt: scheduledStartAt ? at(scheduledStartAt) : null,
          scheduledEndAt: scheduledEndAt ? at(scheduledEndAt) : null,
          timeZone: "Asia/Kolkata",
          estimatedMinutes,
          billable,
          completedAt: completedAt ? at(completedAt) : null,
        },
      });
    }

    for (const [number, clientKey, projectKey, status, amount, issueDate, dueDate, paidDate, description] of invoiceDefinitions) {
      const invoiceId = stableUuid(`invoice:${number}`);
      await transaction.invoice.upsert({
        where: { id: invoiceId },
        create: {
          id: invoiceId,
          userId: user.id,
          clientId: clientIds[clientKey],
          projectId: projectIds[projectKey],
          invoiceNumber: number,
          status,
          currency: "USD",
          subtotal: amount,
          taxRate: 0,
          taxAmount: 0,
          total: amount,
          issueDate: at(issueDate),
          dueDate: at(dueDate),
          paidDate: paidDate ? at(paidDate) : null,
          notes: "Synthetic demo invoice. Thank you — payment by bank transfer.",
          createdAt: at(issueDate),
        },
        update: {
          clientId: clientIds[clientKey],
          projectId: projectIds[projectKey],
          status,
          subtotal: amount,
          total: amount,
          dueDate: at(dueDate),
          paidDate: paidDate ? at(paidDate) : null,
        },
      });
      await transaction.invoiceItem.upsert({
        where: { id: stableUuid(`invoice-item:${number}`) },
        create: {
          id: stableUuid(`invoice-item:${number}`),
          invoiceId,
          description,
          quantity: 1,
          unitPrice: amount,
          amount,
          sortOrder: 0,
        },
        update: { invoiceId, description, unitPrice: amount, amount },
      });
    }

    for (const [key, category, description, amount, date, projectKey, billable] of expenseDefinitions) {
      await transaction.expense.upsert({
        where: { id: stableUuid(`expense:${key}`) },
        create: {
          id: stableUuid(`expense:${key}`),
          userId: user.id,
          projectId: projectKey ? projectIds[projectKey] : null,
          category,
          description,
          amount,
          currency: "USD",
          date: at(date),
          isBillable: billable,
          isReimbursed: billable && date < "2026-07-01" ? true : false,
          createdAt: at(date),
        },
        update: {
          projectId: projectKey ? projectIds[projectKey] : null,
          category,
          description,
          amount,
          currency: "USD",
          date: at(date),
          isBillable: billable,
          isReimbursed: billable && date < "2026-07-01" ? true : false,
        },
      });
    }

    await transaction.calendar.upsert({
      where: { id: calendarId },
      create: {
        id: calendarId,
        userId: user.id,
        name: "Freelance work",
        color: "#2563EB",
        timeZone: "Asia/Kolkata",
        isDefault: true,
        isVisible: true,
      },
      update: { timeZone: "Asia/Kolkata", isVisible: true },
    });

    for (const [key, title, description, startAt, endAt, clientKey, projectKey, meetingUrl] of calendarEventDefinitions) {
      await transaction.calendarEvent.upsert({
        where: { id: stableUuid(`calendar-event:${key}`) },
        create: {
          id: stableUuid(`calendar-event:${key}`),
          userId: user.id,
          calendarId,
          title,
          description,
          meetingUrl,
          startAt: at(startAt),
          endAt: at(endAt),
          allDay: false,
          timeZone: "Asia/Kolkata",
          clientId: clientKey ? clientIds[clientKey] : null,
          projectId: projectKey ? projectIds[projectKey] : null,
          linkBehavior: projectKey || clientKey ? "linked_context" : null,
          source: "native",
          createdAt: at(startAt),
        },
        update: {
          calendarId,
          title,
          description,
          meetingUrl,
          startAt: at(startAt),
          endAt: at(endAt),
          clientId: clientKey ? clientIds[clientKey] : null,
          projectId: projectKey ? projectIds[projectKey] : null,
        },
      });
    }

    const currentPortfolio = portfolioContent(user.portfolio?.content);
    const seededPortfolioProjects = [
      {
        id: "demo-rive",
        title: "rive. — a connected OS for independent work",
        description: "A cohesive workspace that connects client operations, delivery, money, calendar, onboarding, and a public portfolio.",
        role: "Founder, product designer & full-stack engineer",
        year: "2026",
        url: "https://www.rive.work",
        imageUrl: "",
        client: "rive.",
        timeline: "March 2026 — present",
        deliverables: ["Product strategy", "UX and visual system", "Full-stack implementation", "Production operations"],
        gallery: [],
        visibility: "public",
        challenge: "Freelancers lose context across disconnected project, finance, calendar, and portfolio tools.",
        solution: "Designed one operating layer with shared data, linked workflows, practical insights, and a polished public presence.",
        outcome: "Shipped a production-ready platform with connected workflows and a foundation for continuous freelancer operations.",
        tools: ["Next.js", "TypeScript", "PostgreSQL", "Prisma", "Product design"],
      },
      {
        id: "demo-finpilot",
        title: "FinPilot onboarding & analytics",
        description: "A trust-first onboarding and analytics redesign for an early-stage financial product.",
        role: "Product designer & frontend partner",
        year: "2026",
        url: "",
        imageUrl: "",
        client: "FinPilot",
        timeline: "April — June 2026",
        deliverables: ["User journey", "Interactive prototype", "Analytics UI", "Developer handoff"],
        gallery: [],
        visibility: "public",
        challenge: "New users struggled to understand setup progress and the meaning behind key financial metrics.",
        solution: "Simplified the activation journey and organized analytics around decisions, explanations, and confident next actions.",
        outcome: "Delivered an implementation-ready system with clearer activation, better empty states, and reusable dashboard patterns.",
        tools: ["Figma", "UX research", "React", "Design systems"],
      },
      {
        id: "demo-northstar",
        title: "Northstar Labs marketing site",
        description: "A responsive, conversion-focused SaaS website built from positioning through production.",
        role: "Web designer & developer",
        year: "2026",
        url: "",
        imageUrl: "",
        client: "Northstar Labs",
        timeline: "March — April 2026",
        deliverables: ["Information architecture", "Responsive UI", "Frontend build", "SEO and launch"],
        gallery: [],
        visibility: "public",
        challenge: "The product was technically strong but difficult for prospective buyers to understand quickly.",
        solution: "Reframed the story around user outcomes and built a focused site with an extensible visual and component system.",
        outcome: "Launched a faster, clearer marketing experience ready for campaigns, content expansion, and product-led growth.",
        tools: ["Next.js", "TypeScript", "Responsive design", "SEO"],
      },
    ];
    const seededServices = [
      { id: "demo-service-product", title: "Product design", description: "Research, flows, prototypes, and scalable UI systems that make complex products feel clear." },
      { id: "demo-service-web", title: "Web design & development", description: "Responsive, production-ready websites built from positioning and UX through launch." },
      { id: "demo-service-fullstack", title: "Full-stack product builds", description: "Practical MVPs and workflow products spanning frontend, APIs, data, payments, and operations." },
      { id: "demo-service-audit", title: "UX and conversion audits", description: "Focused diagnosis with prioritized recommendations your team can act on immediately." },
    ];
    const seededTestimonials = [
      { id: "demo-testimonial-northstar", quote: "Arnav translated a technical product into a site that feels simple, credible, and ready to sell.", name: "Maya Rao", company: "Northstar Labs" },
      { id: "demo-testimonial-finpilot", quote: "The new onboarding and analytics system gave our team a much clearer product language to build from.", name: "Kabir Mehta", company: "FinPilot" },
    ];
    const mergedPortfolioContent = {
      ...currentPortfolio,
      name: "Arnav Bhattacharya",
      headline: "web developer and product designer building clear, useful digital products.",
      bio: "I design and build production-ready SaaS products and high-converting websites—from product strategy and UX systems to full-stack implementation. I’m currently building rive., a connected operating system for freelancers.",
      location: "Bengaluru, India · working worldwide",
      availability: "available for select product and web engagements",
      contactEmail: targetEmail,
      social: currentPortfolio.social.some((item) => item?.url === "https://www.rive.work")
        ? currentPortfolio.social
        : [...currentPortfolio.social, { label: "rive.", url: "https://www.rive.work" }],
      projects: mergeById(currentPortfolio.projects, seededPortfolioProjects),
      services: mergeById(currentPortfolio.services, seededServices),
      testimonials: mergeById(currentPortfolio.testimonials, seededTestimonials),
      sections: [
        { key: "about", visible: true },
        { key: "projects", visible: true },
        { key: "services", visible: true },
        { key: "testimonials", visible: true },
        { key: "contact", visible: true },
      ],
    };
    await transaction.portfolio.upsert({
      where: { userId: user.id },
      create: {
        id: portfolioId,
        userId: user.id,
        slug: user.portfolio?.slug || "atzgg132",
        status: user.portfolio?.status || "draft",
        templateKey: "digital-builder",
        content: mergedPortfolioContent,
        theme: { accent: "#2563EB", mode: "light", radius: "soft" },
        seo: {
          title: "Arnav Bhattacharya — Web Developer & Product Designer",
          description: "Product design and full-stack web development for SaaS teams, founders, and independent businesses.",
          // A development showcase must never compete with the real site in search.
          indexable: false,
        },
      },
      update: {
        content: mergedPortfolioContent,
        templateKey: "digital-builder",
        seo: {
          title: "Arnav Bhattacharya — Web Developer & Product Designer",
          description: "Product design and full-stack web development for SaaS teams, founders, and independent businesses.",
          // A development showcase must never compete with the real site in search.
          indexable: false,
        },
        revision: { increment: 1 },
      },
    });

    const referrers = ["https://www.google.com", "https://www.linkedin.com", null, "https://news.ycombinator.com"];
    const devices = ["desktop", "mobile", "desktop", "tablet", "mobile"];

    /* Landing-page traffic. Every row is explicitly a portfolio-home view so the
       Analytics split between the portfolio and its case studies is meaningful
       rather than an artefact of the default. */
    await transaction.portfolioView.createMany({
      data: Array.from({ length: 96 }, (_, index) => ({
        id: stableUuid(`portfolio-view:${index}`),
        portfolioId,
        pageType: "portfolio",
        projectId: null,
        visitorHash: `demo-visitor-${index % 41}`,
        referrer: referrers[index % referrers.length],
        deviceType: devices[index % devices.length],
        viewedAt: new Date(at("2026-07-28T18:00:00+05:30").getTime() - (index % 30) * 86400000 - (index % 9) * 3600000),
      })),
      skipDuplicates: true,
    });

    /* Case-study traffic, deliberately uneven: the demo is only useful if "top
       projects" has a real ranking to show, and if one well-read project has no
       enquiries against it so the unconverted-work callout has something honest
       to fire on. */
    const projectTraffic = [
      { projectId: "demo-rive", views: 54, visitors: 28 },
      { projectId: "demo-finpilot", views: 31, visitors: 19 },
      { projectId: "demo-northstar", views: 12, visitors: 9 },
    ];
    await transaction.portfolioView.createMany({
      data: projectTraffic.flatMap(({ projectId, views, visitors }) =>
        Array.from({ length: views }, (_, index) => ({
          id: stableUuid(`portfolio-project-view:${projectId}:${index}`),
          portfolioId,
          pageType: "project",
          projectId,
          visitorHash: `demo-visitor-${projectId}-${index % visitors}`,
          referrer: referrers[index % referrers.length],
          deviceType: devices[index % devices.length],
          viewedAt: new Date(at("2026-07-28T18:00:00+05:30").getTime() - (index % 27) * 86400000 - (index % 7) * 3600000),
        })),
      ),
      skipDuplicates: true,
    });

    /* Demo enquiries across the whole lifecycle, including one the outbox gave
       up on, so the "we kept your lead even though the email failed" warning is
       visible without having to break a mail provider to see it.

       Every message is prefixed and every address sits on example.invalid, a
       reserved domain that can never receive mail: nobody reading this inbox
       should be able to mistake a fixture for a real prospective client. */
    const demoInquiries = [
      {
        key: "aanya",
        name: "Aanya Kulkarni",
        email: "aanya@example.invalid",
        projectType: "Product design for a B2B dashboard",
        message: "We are rebuilding our analytics dashboard and need help making a dense product feel simple. Roughly a ten week engagement starting next month.",
        status: "new",
        sourceProjectId: "demo-finpilot",
        notificationStatus: "sent",
        daysAgo: 1,
      },
      {
        key: "marcus",
        name: "Marcus Webb",
        email: "marcus@example.invalid",
        projectType: "Marketing site rebuild",
        message: "Our site does not explain what we do. Looking for positioning, design, and a build we can extend ourselves afterwards.",
        status: "read",
        sourceProjectId: "demo-northstar",
        notificationStatus: "sent",
        daysAgo: 4,
      },
      {
        key: "priya",
        name: "Priya Raghavan",
        email: "priya@example.invalid",
        projectType: "Full-stack MVP",
        message: "Early stage, funded, and we need a working product in front of customers this quarter. Keen to talk about scope and sequencing.",
        status: "replied",
        sourceProjectId: "demo-rive",
        notificationStatus: "sent",
        daysAgo: 9,
      },
      {
        key: "tomas",
        name: "Tomas Lindqvist",
        email: "tomas@example.invalid",
        projectType: "UX audit",
        message: "We would like a focused audit of our onboarding with prioritised recommendations our team can act on.",
        status: "archived",
        sourceProjectId: null,
        notificationStatus: "failed",
        notificationError: "Demo fixture: the notification email was not delivered.",
        daysAgo: 21,
      },
      {
        key: "growth-bot",
        name: "Growth Partners",
        email: "offers@example.invalid",
        projectType: "SEO services",
        message: "We can get your website to the top of search results this week. Reply for our pricing sheet.",
        status: "spam",
        sourceProjectId: null,
        notificationStatus: "sent",
        daysAgo: 6,
      },
    ];

    const demoNow = at("2026-07-28T18:00:00+05:30").getTime();
    for (const inquiry of demoInquiries) {
      const createdAt = new Date(demoNow - inquiry.daysAgo * 86400000);
      const id = stableUuid(`portfolio-inquiry:${inquiry.key}`);
      const data = {
        portfolioId,
        userId: user.id,
        sourceProjectId: inquiry.sourceProjectId,
        name: inquiry.name,
        email: inquiry.email,
        projectType: inquiry.projectType,
        message: `[Demo enquiry — synthetic sample data] ${inquiry.message}`,
        status: inquiry.status,
        notificationStatus: inquiry.notificationStatus,
        notificationError: inquiry.notificationError || null,
        // No outbox job: these were never really sent, and correlating them to
        // one would make the retry worker act on a fixture.
        outboxId: null,
        visitorHash: `demo-visitor-inquiry-${inquiry.key}`,
        referrer: referrers[inquiry.key.length % referrers.length],
        deviceType: devices[inquiry.key.length % devices.length],
        createdAt,
        readAt: inquiry.status === "new" ? null : createdAt,
        repliedAt: inquiry.status === "replied" ? new Date(createdAt.getTime() + 7200000) : null,
        archivedAt: ["archived", "spam"].includes(inquiry.status) ? new Date(createdAt.getTime() + 86400000) : null,
      };
      await transaction.portfolioInquiry.upsert({ where: { id }, create: { id, ...data }, update: data });
    }
  }, { timeout: 60000 });
}

try {
  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: {
      portfolio: true,
      calendars: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
    },
  });
  if (!user) throw new Error(`No user exists for ${targetEmail}.`);

  const before = await snapshot(user.id);
  console.log(JSON.stringify({ mode: shouldApply ? "apply" : "inspect", email: targetEmail, before }, null, 2));
  if (!shouldApply) {
    console.log("No changes made. Re-run with --apply to seed this account.");
  } else {
    await seed(user);
    const after = await snapshot(user.id);
    console.log(JSON.stringify({ success: true, email: targetEmail, after }, null, 2));
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
