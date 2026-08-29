import { checkServerIdentity } from "node:tls";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import {
  FIXTURE,
  fixtureIds,
  parseSeedArgs,
  refuseProduction,
  stableUuid,
  summarizeFixture,
} from "./lib/launch-film-fixture.mjs";

const { email: targetEmail, apply: shouldApply, state } = parseSeedArgs(process.argv.slice(2));
refuseProduction(process.env);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const parsedConnection = new URL(process.env.DATABASE_URL);
for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsedConnection.searchParams.delete(parameter);
const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
const pool = new Pool({
  connectionString: parsedConnection.toString(),
  ssl: {
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
    ...(sslServerName ? { checkServerIdentity: (_hostname, certificate) => checkServerIdentity(sslServerName, certificate) } : {}),
  },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function mergeById(existing, additions) {
  const additionIds = new Set(additions.map((item) => item.id));
  return [...additions, ...existing.filter((item) => !additionIds.has(item?.id))];
}

function portfolioContent(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    name: typeof input.name === "string" ? input.name : FIXTURE.operator.name,
    profileImageUrl: typeof input.profileImageUrl === "string" ? input.profileImageUrl : "",
    profileImageSourceUrl: typeof input.profileImageSourceUrl === "string" ? input.profileImageSourceUrl : "",
    showProfileImage: Boolean(input.showProfileImage),
    tagline: typeof input.tagline === "string" ? input.tagline : "Independent brand design",
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
    practices: Array.isArray(input.practices) ? input.practices : [],
    practiceLayout: input.practiceLayout === "separate" ? "separate" : "unified",
    mediaSettings: input.mediaSettings && typeof input.mediaSettings === "object" ? input.mediaSettings : {},
  };
}

async function snapshot(userId, ids) {
  const [
    clients,
    projects,
    milestones,
    tasks,
    invoices,
    invoiceItems,
    payments,
    expenses,
    calendarEvents,
    fixtureClient,
    fixtureProject,
    fixturePayments,
    portfolio,
  ] = await Promise.all([
    prisma.client.count({ where: { userId } }),
    prisma.project.count({ where: { userId } }),
    prisma.milestone.count({ where: { project: { userId } } }),
    prisma.task.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId } }),
    prisma.invoiceItem.count({ where: { invoice: { userId } } }),
    prisma.invoicePayment.count({ where: { invoice: { userId } } }),
    prisma.expense.count({ where: { userId } }),
    prisma.calendarEvent.count({ where: { userId, deletedAt: null } }),
    prisma.client.findUnique({ where: { id: ids.client }, select: { id: true, company: true } }),
    prisma.project.findUnique({ where: { id: ids.project }, select: { id: true, title: true, budget: true, currency: true } }),
    prisma.invoicePayment.count({ where: { id: ids.payment } }),
    prisma.portfolio.findUnique({
      where: { userId },
      select: { id: true, slug: true, status: true, content: true },
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
    payments,
    expenses,
    calendarEvents,
    fixture: {
      client: Boolean(fixtureClient),
      project: Boolean(fixtureProject),
      payment: fixturePayments,
      portfolioProject: Boolean(content?.projects.some((item) => item.id === FIXTURE.portfolio.project.id)),
    },
    portfolio: portfolio
      ? {
          slug: portfolio.slug,
          status: portfolio.status,
          projects: content.projects.length,
          testimonials: content.testimonials.length,
        }
      : null,
  };
}

async function seed(user, ids) {
  const milestoneState = FIXTURE.milestoneState(state);
  const productionDone = state === "after";
  const portfolioId = user.portfolio?.id || stableUuid(`portfolio:${user.id}`);
  const calendarId = user.calendars[0]?.id || stableUuid(`calendar:${user.id}`);
  const slug = user.portfolio?.slug || `lf-${ids.client.replace(/-/g, "").slice(0, 12)}`;

  await prisma.$transaction(async (transaction) => {
    const existingOnboarding = user.onboardingData && typeof user.onboardingData === "object" && !Array.isArray(user.onboardingData)
      ? user.onboardingData
      : {};
    await transaction.user.update({
      where: { id: user.id },
      data: {
        name: FIXTURE.operator.name,
        businessType: FIXTURE.operator.businessType,
        profession: FIXTURE.operator.profession,
        currency: FIXTURE.currency,
        displayCurrency: FIXTURE.currency,
        timeZone: FIXTURE.timeZone,
        onboardingStatus: "complete",
        onboardingStep: 5,
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
        onboardingData: {
          ...existingOnboarding,
          goal: "organize",
          demoPersona: "Synthetic launch-film operator. Not a real customer account.",
        },
      },
    });

    const client = FIXTURE.client;
    await transaction.client.upsert({
      where: { id: ids.client },
      create: {
        id: ids.client,
        userId: user.id,
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
        dataOrigin: FIXTURE.dataOrigin,
        createdAt: client.createdAt,
      },
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
        dataOrigin: FIXTURE.dataOrigin,
      },
    });

    const project = FIXTURE.project;
    await transaction.project.upsert({
      where: { id: ids.project },
      create: {
        id: ids.project,
        userId: user.id,
        clientId: ids.client,
        title: project.title,
        description: project.description,
        status: productionDone ? "completed" : project.status,
        priority: project.priority,
        startDate: project.startDate,
        dueDate: project.dueDate,
        budget: project.budget,
        currency: FIXTURE.currency,
        tags: project.tags,
        dataOrigin: FIXTURE.dataOrigin,
        createdAt: project.createdAt,
      },
      update: {
        clientId: ids.client,
        title: project.title,
        description: project.description,
        status: productionDone ? "completed" : project.status,
        priority: project.priority,
        startDate: project.startDate,
        dueDate: project.dueDate,
        budget: project.budget,
        currency: FIXTURE.currency,
        tags: project.tags,
        dataOrigin: FIXTURE.dataOrigin,
      },
    });

    for (const milestone of FIXTURE.milestones) {
      const resolved = milestoneState[milestone.key === "final" ? "final" : milestone.key];
      await transaction.milestone.upsert({
        where: { id: ids.milestones[milestone.key] },
        create: {
          id: ids.milestones[milestone.key],
          projectId: ids.project,
          title: milestone.title,
          dueDate: milestone.dueDate,
          completed: resolved.completed,
          completedAt: resolved.completedAt,
          createdAt: project.createdAt,
        },
        update: {
          title: milestone.title,
          dueDate: milestone.dueDate,
          completed: resolved.completed,
          completedAt: resolved.completedAt,
        },
      });
    }

    for (const task of FIXTURE.tasks) {
      const done = task.key === "production" || task.key === "handoff" ? productionDone : task.status === "done";
      await transaction.task.upsert({
        where: { id: ids.tasks[task.key] },
        create: {
          id: ids.tasks[task.key],
          userId: user.id,
          projectId: ids.project,
          milestoneId: ids.milestones[task.milestoneKey],
          title: task.title,
          description: `Synthetic launch-film task for ${project.title}.`,
          status: done ? "done" : task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          timeZone: FIXTURE.timeZone,
          estimatedMinutes: task.estimatedMinutes,
          billable: task.billable,
          completedAt: done ? (task.completedAt || resolvedFinalCompletedAt(productionDone)) : null,
          createdAt: project.createdAt,
        },
        update: {
          projectId: ids.project,
          milestoneId: ids.milestones[task.milestoneKey],
          title: task.title,
          status: done ? "done" : task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          timeZone: FIXTURE.timeZone,
          estimatedMinutes: task.estimatedMinutes,
          billable: task.billable,
          completedAt: done ? (task.completedAt || resolvedFinalCompletedAt(productionDone)) : null,
        },
      });
    }

    for (const invoice of FIXTURE.invoices) {
      const invoiceId = ids.invoices[invoice.key];
      const amountPaid = invoice.status === "paid" ? invoice.total : 0;
      await transaction.invoice.upsert({
        where: { id: invoiceId },
        create: {
          id: invoiceId,
          userId: user.id,
          clientId: ids.client,
          projectId: ids.project,
          invoiceNumber: invoice.number,
          status: invoice.status,
          currency: FIXTURE.currency,
          subtotal: invoice.total,
          taxRate: 0,
          taxAmount: 0,
          total: invoice.total,
          amountPaid,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          paidDate: invoice.paidDate,
          sentAt: invoice.sentAt,
          notes: "Synthetic launch-film invoice. Payment is recorded in Rive; Rive did not process funds.",
          dataOrigin: FIXTURE.dataOrigin,
          createdAt: invoice.issueDate,
        },
        update: {
          clientId: ids.client,
          projectId: ids.project,
          status: invoice.status,
          currency: FIXTURE.currency,
          subtotal: invoice.total,
          total: invoice.total,
          amountPaid,
          dueDate: invoice.dueDate,
          paidDate: invoice.paidDate,
          sentAt: invoice.sentAt,
          notes: "Synthetic launch-film invoice. Payment is recorded in Rive; Rive did not process funds.",
          dataOrigin: FIXTURE.dataOrigin,
        },
      });
      for (const [index, item] of invoice.items.entries()) {
        const itemId = stableUuid(`invoice-item:${invoice.number}:${index}`);
        await transaction.invoiceItem.upsert({
          where: { id: itemId },
          create: {
            id: itemId,
            invoiceId,
            description: item.description,
            quantity: 1,
            unitPrice: item.amount,
            amount: item.amount,
            sortOrder: index,
          },
          update: { invoiceId, description: item.description, unitPrice: item.amount, amount: item.amount, sortOrder: index },
        });
      }
    }

    const payment = FIXTURE.payments[0];
    await transaction.invoicePayment.upsert({
      where: { id: ids.payment },
      create: {
        id: ids.payment,
        invoiceId: ids.invoices.paid,
        amount: payment.amount,
        paidAt: payment.paidAt,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        idempotencyKey: payment.idempotencyKey,
      },
      update: {
        invoiceId: ids.invoices.paid,
        amount: payment.amount,
        paidAt: payment.paidAt,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        idempotencyKey: payment.idempotencyKey,
      },
    });
    await transaction.invoiceEvent.upsert({
      where: { id: stableUuid("invoice-event:ns-1001:paid") },
      create: {
        id: stableUuid("invoice-event:ns-1001:paid"),
        invoiceId: ids.invoices.paid,
        userId: user.id,
        eventType: "paid",
        metadata: { amount: String(payment.amount), method: payment.method, synthetic: true },
        createdAt: payment.paidAt,
      },
      update: {
        eventType: "paid",
        metadata: { amount: String(payment.amount), method: payment.method, synthetic: true },
      },
    });

    for (const expense of FIXTURE.expenses) {
      await transaction.expense.upsert({
        where: { id: ids.expenses[expense.key] },
        create: {
          id: ids.expenses[expense.key],
          userId: user.id,
          projectId: ids.project,
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          currency: FIXTURE.currency,
          date: expense.date,
          isBillable: expense.billable,
          isReimbursed: false,
          dataOrigin: FIXTURE.dataOrigin,
          createdAt: expense.date,
        },
        update: {
          projectId: ids.project,
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          currency: FIXTURE.currency,
          date: expense.date,
          isBillable: expense.billable,
          dataOrigin: FIXTURE.dataOrigin,
        },
      });
    }

    await transaction.calendar.upsert({
      where: { id: calendarId },
      create: {
        id: calendarId,
        userId: user.id,
        name: "Studio work",
        color: "#1D4ED8",
        timeZone: FIXTURE.timeZone,
        isDefault: true,
        isVisible: true,
      },
      update: { timeZone: FIXTURE.timeZone, isVisible: true },
    });
    const event = FIXTURE.calendarEvents[0];
    await transaction.calendarEvent.upsert({
      where: { id: ids.calendarEvent },
      create: {
        id: ids.calendarEvent,
        userId: user.id,
        calendarId,
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        allDay: false,
        timeZone: FIXTURE.timeZone,
        clientId: ids.client,
        projectId: ids.project,
        milestoneId: ids.milestones.final,
        linkBehavior: "linked_context",
        source: "native",
        dataOrigin: FIXTURE.dataOrigin,
        createdAt: event.startAt,
      },
      update: {
        calendarId,
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        clientId: ids.client,
        projectId: ids.project,
        milestoneId: ids.milestones.final,
        dataOrigin: FIXTURE.dataOrigin,
      },
    });

    const currentPortfolio = portfolioContent(user.portfolio?.content);
    const mergedPortfolioContent = {
      ...currentPortfolio,
      name: FIXTURE.operator.name,
      tagline: "Independent brand design",
      headline: "Brand systems with the client, the work, and the proof still attached.",
      bio: "Synthetic launch-film operator. Independent brand designer. This account exists only to film Rive.",
      location: "Bengaluru, India",
      availability: "Select engagements",
      contactEmail: "studio@launch-film.example",
      projects: mergeById(currentPortfolio.projects, [FIXTURE.portfolio.project]),
      testimonials: mergeById(currentPortfolio.testimonials, [FIXTURE.portfolio.testimonial]),
      services: mergeById(currentPortfolio.services, [
        { id: "launch-film-brand", title: "Brand systems", description: "Identity, templates, and rollout language for independent studios." },
      ]),
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
        slug,
        status: "published",
        templateKey: "visual-studio",
        content: mergedPortfolioContent,
        theme: { accent: "#1D4ED8", mode: "light", radius: "soft" },
        seo: {
          title: "Asha Iyer — Brand systems",
          description: "Synthetic launch-film portfolio. Not a real public practice.",
          indexable: false,
        },
        publishedAt: new Date("2026-08-22T12:00:00+05:30"),
      },
      update: {
        content: mergedPortfolioContent,
        templateKey: "visual-studio",
        status: "published",
        seo: {
          title: "Asha Iyer — Brand systems",
          description: "Synthetic launch-film portfolio. Not a real public practice.",
          indexable: false,
        },
        publishedAt: user.portfolio?.publishedAt || new Date("2026-08-22T12:00:00+05:30"),
        revision: { increment: 1 },
      },
    });
  }, { timeout: 60000 });

  return slug;
}

function resolvedFinalCompletedAt(productionDone) {
  return productionDone ? FIXTURE.milestones[2].completedAt : null;
}

try {
  const ids = fixtureIds();
  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: {
      portfolio: true,
      calendars: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
    },
  });
  if (!user) throw new Error(`No user exists for ${targetEmail}. Create the dedicated launch-film account first.`);

  const before = await snapshot(user.id, ids);
  const fixtureSummary = summarizeFixture();
  const routes = {
    client: `/workflow/clients/${ids.client}`,
    project: `/workflow/projects/${ids.project}`,
    invoicePaid: `/workflow/invoices/${ids.invoices.paid}`,
    invoiceOutstanding: `/workflow/invoices/${ids.invoices.outstanding}`,
    dashboard: "/dashboard",
    revenue: "/workflow/revenue",
    expenses: "/workflow/expenses",
    portfolio: "/portfolio",
  };

  if (!shouldApply) {
    console.log(JSON.stringify({
      mode: "inspect",
      email: targetEmail,
      state,
      ids: fixtureSummary,
      routes,
      before,
    }, null, 2));
    console.log("No changes made. Re-run with --apply to seed this account.");
  } else {
    const slug = await seed(user, ids);
    const after = await snapshot(user.id, ids);
    console.log(JSON.stringify({
      success: true,
      mode: "apply",
      email: targetEmail,
      state,
      ids: fixtureSummary,
      routes: {
        ...routes,
        caseStudy: `/p/${slug}/work/${FIXTURE.portfolio.project.id}`,
        publicPortfolio: `/p/${slug}`,
      },
      before,
      after,
    }, null, 2));
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
