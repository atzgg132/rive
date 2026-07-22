import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { buildPrefilledPortfolioContent, DEFAULT_PORTFOLIO_THEME, mergePortfolioContent, normalizeSlug, validatePortfolioContent } from "@/utils/portfolio";

function unauthorized() {
  return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
}

async function getOwner(req: NextRequest) {
  return getSessionUser(req);
}

export async function GET(req: NextRequest) {
  const session = await getOwner(req);
  if (!session) return unauthorized();

  try {
    const portfolio = await prisma.portfolio.findUnique({ where: { userId: session.userId } });
    return NextResponse.json({ success: true, portfolio });
  } catch (error) {
    console.error("Portfolio fetch error:", error);
    return NextResponse.json({ success: false, message: "Could not load portfolio." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getOwner(req);
  if (!session) return unauthorized();

  try {
    const existing = await prisma.portfolio.findUnique({ where: { userId: session.userId } });
    if (existing) return NextResponse.json({ success: true, portfolio: existing, created: false });

    const body = await req.json().catch(() => ({}));
    const requestedSlug = normalizeSlug(typeof body.slug === "string" ? body.slug : "");
    const baseSlug = requestedSlug || normalizeSlug(session.email.split("@")[0]) || "your-portfolio";
    let slug = baseSlug;
    let suffix = 2;
    while (await prisma.portfolio.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        name: true,
        email: true,
        projects: {
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, description: true, tags: true, startDate: true, updatedAt: true },
        },
      },
    });
    if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

    const portfolio = await prisma.portfolio.create({
      data: {
        userId: session.userId,
        slug,
        templateKey: typeof body.templateKey === "string" ? body.templateKey : "minimal-pro",
        content: buildPrefilledPortfolioContent(user),
        theme: DEFAULT_PORTFOLIO_THEME,
        seo: { title: "", description: "", indexable: true },
      },
    });
    return NextResponse.json({ success: true, portfolio, created: true }, { status: 201 });
  } catch (error) {
    console.error("Portfolio create error:", error);
    return NextResponse.json({ success: false, message: "Could not create portfolio." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getOwner(req);
  if (!session) return unauthorized();

  try {
    const body = await req.json();
    if (JSON.stringify(body).length > 10_000_000) return NextResponse.json({ success: false, message: "Portfolio payload is too large." }, { status: 413 });
    const current = await prisma.portfolio.findUnique({ where: { userId: session.userId } });
    if (!current) return NextResponse.json({ success: false, message: "Create a portfolio first." }, { status: 404 });
    if (body.revision !== undefined && Number(body.revision) !== current.revision) {
      return NextResponse.json({ success: false, message: "This portfolio changed in another tab. Reload before saving.", conflict: true }, { status: 409 });
    }

    const data: Record<string, unknown> = { revision: current.revision + 1 };
    if (body.content !== undefined) {
      const contentError = validatePortfolioContent(body.content);
      if (contentError) return NextResponse.json({ success: false, message: contentError }, { status: 400 });
      data.content = mergePortfolioContent(body.content);
    }
    if (body.theme !== undefined) data.theme = { ...current.theme as object, ...body.theme };
    if (body.templateKey !== undefined && typeof body.templateKey === "string") data.templateKey = body.templateKey;
    if (body.seo !== undefined) data.seo = body.seo;
    if (body.slug !== undefined) {
      const slug = normalizeSlug(String(body.slug));
      if (!slug) return NextResponse.json({ success: false, message: "Choose a valid public URL." }, { status: 400 });
      const collision = await prisma.portfolio.findFirst({ where: { slug, NOT: { userId: session.userId } } });
      if (collision) return NextResponse.json({ success: false, message: "That public URL is already taken." }, { status: 409 });
      data.slug = slug;
    }
    if (body.status === "published" || body.status === "draft") {
      data.status = body.status;
      data.publishedAt = body.status === "published" ? new Date() : null;
    }

    const portfolio = await prisma.portfolio.update({ where: { userId: session.userId }, data });
    return NextResponse.json({ success: true, portfolio });
  } catch (error) {
    console.error("Portfolio update error:", error);
    return NextResponse.json({ success: false, message: "Could not save portfolio." }, { status: 500 });
  }
}
