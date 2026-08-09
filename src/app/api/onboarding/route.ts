import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { isDateOnly, isValidTimeZone } from "@/utils/calendar";
import { isValidOnboardingAvatarUrl, mergePortfolioContent } from "@/utils/portfolio";
import { ensureDefaultCalendar } from "@/utils/calendar";
import { ensurePrefilledPortfolio } from "@/utils/portfolioProvisioning";
import { googleCalendarAvailable, zohoBooksAvailable } from "@/utils/connectorConfig";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";

const BUSINESS_TYPES = ["freelancer", "contractor", "studio", "consultant", "creator", "small_business"];
const GOALS = ["organize", "get_paid", "understand_finances", "publish_portfolio", "migrate"];
const STARTING_SOURCES = ["spreadsheets", "zoho_books", "quickbooks", "xero", "freshbooks", "google_calendar", "project_tool", "starting_fresh"];

function unauthorized() {
  return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return unauthorized();

  const [user, clients, projects, invoices, expenses, connections, businessConnections] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        onboardingStatus: true,
        onboardingStep: true,
        businessType: true,
        profession: true,
        currency: true,
        timeZone: true,
        onboardingData: true,
        businessTypes: true,
      },
    }),
    prisma.client.count({ where: { userId: session.userId } }),
    prisma.project.count({ where: { userId: session.userId } }),
    prisma.invoice.count({ where: { userId: session.userId } }),
    prisma.expense.count({ where: { userId: session.userId } }),
    prisma.calendarConnection.findMany({
      where: { userId: session.userId },
      select: { id: true, provider: true, accountEmail: true, status: true, lastSyncedAt: true },
    }),
    prisma.connectorConnection.findMany({
      where: { userId: session.userId },
      select: { id: true, provider: true, accountLabel: true, status: true, lastSyncedAt: true, lastError: true },
    }),
  ]);
  if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

  return NextResponse.json({
    success: true,
    user,
    counts: { clients, projects, invoices, expenses },
    connections,
    businessConnections,
    connectorAvailability: {
      googleCalendar: googleCalendarAvailable(),
      zohoBooks: zohoBooksAvailable(),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, message: "A valid request body is required." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 120);
  if (typeof body.profession === "string") data.profession = body.profession.trim().slice(0, 120) || null;
  if (Object.prototype.hasOwnProperty.call(body, "businessTypes")) {
    if (!Array.isArray(body.businessTypes) || body.businessTypes.length === 0 || body.businessTypes.length > BUSINESS_TYPES.length) {
      return NextResponse.json({ success: false, message: "Choose at least one valid business type." }, { status: 400 });
    }
    const requestedBusinessTypes = body.businessTypes as unknown[];
    if (requestedBusinessTypes.some((value) => typeof value !== "string" || !BUSINESS_TYPES.includes(value))) {
      return NextResponse.json({ success: false, message: "Choose only supported business types." }, { status: 400 });
    }
    const businessTypes = Array.from(new Set(requestedBusinessTypes as string[]));
    if (businessTypes.length === 0) {
      return NextResponse.json({ success: false, message: "Choose at least one valid business type." }, { status: 400 });
    }
    data.businessTypes = businessTypes;
    data.businessType = businessTypes[0];
  } else if (Object.prototype.hasOwnProperty.call(body, "businessType")) {
    if (typeof body.businessType !== "string" || !BUSINESS_TYPES.includes(body.businessType)) {
      return NextResponse.json({ success: false, message: "Choose a supported business type." }, { status: 400 });
    }
    data.businessType = body.businessType;
    data.businessTypes = [body.businessType];
  }
  if (typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency)) data.currency = body.currency;
  if (typeof body.timeZone === "string" && isValidTimeZone(body.timeZone)) data.timeZone = body.timeZone;
  if (Number.isInteger(body.step) && body.step >= 0 && body.step <= 5) data.onboardingStep = body.step;
  if (body.status === "in_progress" || body.status === "complete" || body.status === "skipped") {
    data.onboardingStatus = body.status;
  }
  if (body.goal && GOALS.includes(body.goal) || Array.isArray(body.sources)) {
    const current = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { onboardingData: true },
    });
    const onboardingData = current?.onboardingData && typeof current.onboardingData === "object" && !Array.isArray(current.onboardingData)
      ? current.onboardingData as Record<string, unknown>
      : {};
    data.onboardingData = {
      ...onboardingData,
      ...(body.goal && GOALS.includes(body.goal) ? { goal: body.goal } : {}),
      ...(Array.isArray(body.sources)
        ? { sources: body.sources.filter((source: unknown): source is string => typeof source === "string" && STARTING_SOURCES.includes(source)).slice(0, 8) }
        : {}),
    };
  }
  if (typeof body.avatarUrl === "string") {
    const avatarUrl = body.avatarUrl.trim();
    if (avatarUrl && !isValidOnboardingAvatarUrl(avatarUrl)) {
      return NextResponse.json({ success: false, message: "Profile photo must be a supported upload or HTTPS URL under 1.8 MB." }, { status: 400 });
    }
    data.avatarUrl = avatarUrl || null;
  }

  const user = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.update({
      where: { id: session.userId },
      data,
      select: {
        name: true,
        avatarUrl: true,
        onboardingStatus: true,
        onboardingStep: true,
        businessType: true,
        businessTypes: true,
        profession: true,
        currency: true,
        timeZone: true,
      },
    });
    if (data.avatarUrl !== undefined) {
      const portfolio = await transaction.portfolio.findUnique({ where: { userId: session.userId } });
      if (portfolio) {
        const content = mergePortfolioContent(portfolio.content);
        await transaction.portfolio.update({
          where: { userId: session.userId },
          data: {
            content: { ...content, profileImageUrl: updated.avatarUrl || "" },
            revision: { increment: 1 },
          },
        });
      }
    }
    return updated;
  });
  if (body.status === "complete" || body.status === "skipped") {
    await Promise.all([
      ensureDefaultCalendar(session.userId, user.timeZone),
      ensurePrefilledPortfolio(session.userId),
    ]);
  }
  if (body.step > 0 || body.status === "in_progress") {
    await recordActivationEvent(session.userId, ACTIVATION_EVENTS.onboardingStarted, { step: Number(body.step) || 0 });
  }
  return NextResponse.json({ success: true, user });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return unauthorized();
  if (!rateLimit(`onboarding-quickstart:${session.userId}:${getRequestIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many attempts. Please try again later." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || body.mode !== "quickstart") {
    return NextResponse.json({ success: false, message: "A valid quick-start request is required." }, { status: 400 });
  }
  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
  const projectTitle = typeof body.projectTitle === "string" ? body.projectTitle.trim() : "";
  if (!clientName || !projectTitle) {
    return NextResponse.json({ success: false, message: "Client and project names are required." }, { status: 400 });
  }
  const dueDate = typeof body.dueDate === "string" && isDateOnly(body.dueDate)
    ? new Date(`${body.dueDate}T12:00:00Z`)
    : null;
  const amount = Number(body.invoiceAmount);
  const currency = typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency) ? body.currency : "USD";

  const result = await prisma.$transaction(async (transaction) => {
    const client = await transaction.client.create({
      data: {
        userId: session.userId,
        name: clientName.slice(0, 160),
        email: typeof body.clientEmail === "string" && /^\S+@\S+\.\S+$/.test(body.clientEmail.trim()) ? body.clientEmail.trim().toLowerCase() : null,
        avatarColor: "#2563EB",
        tags: [],
      },
    });
    const project = await transaction.project.create({
      data: {
        userId: session.userId,
        clientId: client.id,
        title: projectTitle.slice(0, 200),
        description: typeof body.projectDescription === "string" ? body.projectDescription.trim().slice(0, 2_000) || null : null,
        dueDate,
        budget: Number.isFinite(amount) && amount > 0 ? amount : null,
        currency,
        tags: [],
      },
    });
    let invoice = null;
    if (Number.isFinite(amount) && amount > 0) {
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      invoice = await transaction.invoice.create({
        data: {
          userId: session.userId,
          clientId: client.id,
          projectId: project.id,
          invoiceNumber,
          status: "draft",
          currency,
          subtotal: amount,
          total: amount,
          dueDate,
          items: {
            create: {
              description: projectTitle.slice(0, 200),
              quantity: 1,
              unitPrice: amount,
              amount,
            },
          },
        },
      });
    }
    await transaction.user.update({
      where: { id: session.userId },
      data: { onboardingStatus: "complete", onboardingStep: 5 },
    });
    return { client, project, invoice };
  });
  await Promise.all([
    ensureDefaultCalendar(session.userId),
    ensurePrefilledPortfolio(session.userId),
    recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstClientCreated, { clientId: result.client.id }),
    recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstProjectCreated, { projectId: result.project.id }),
  ]);

  return NextResponse.json({ success: true, result }, { status: 201 });
}
