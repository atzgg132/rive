import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { isDateOnly, isValidTimeZone } from "@/utils/calendar";
import { mergePortfolioContent } from "@/utils/portfolio";

const IMAGE = /^(?:data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s<>]+)$/i;
const BUSINESS_TYPES = ["freelancer", "studio", "consultant", "creator", "small_business"];
const GOALS = ["organize", "get_paid", "understand_finances", "publish_portfolio", "migrate"];

function unauthorized() {
  return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) return unauthorized();

  const [user, clients, projects, invoices, expenses] = await Promise.all([
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
      },
    }),
    prisma.client.count({ where: { userId: session.userId } }),
    prisma.project.count({ where: { userId: session.userId } }),
    prisma.invoice.count({ where: { userId: session.userId } }),
    prisma.expense.count({ where: { userId: session.userId } }),
  ]);
  if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

  return NextResponse.json({
    success: true,
    user,
    counts: { clients, projects, invoices, expenses },
  });
}

export async function PATCH(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, message: "A valid request body is required." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 120);
  if (typeof body.profession === "string") data.profession = body.profession.trim().slice(0, 120) || null;
  if (BUSINESS_TYPES.includes(body.businessType)) data.businessType = body.businessType;
  if (typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency)) data.currency = body.currency;
  if (typeof body.timeZone === "string" && isValidTimeZone(body.timeZone)) data.timeZone = body.timeZone;
  if (Number.isInteger(body.step) && body.step >= 0 && body.step <= 5) data.onboardingStep = body.step;
  if (body.status === "in_progress" || body.status === "complete" || body.status === "skipped") {
    data.onboardingStatus = body.status;
  }
  if (body.goal && GOALS.includes(body.goal)) {
    data.onboardingData = { goal: body.goal };
  }
  if (typeof body.avatarUrl === "string") {
    const avatarUrl = body.avatarUrl.trim();
    if (avatarUrl && (avatarUrl.length > 2_500_000 || !IMAGE.test(avatarUrl))) {
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
  return NextResponse.json({ success: true, user });
}

export async function POST(req: NextRequest) {
  const session = getSessionUser(req);
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

  return NextResponse.json({ success: true, result }, { status: 201 });
}
