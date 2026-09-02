import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { isBlankPortfolioProject, isPortfolioProjectMeaningful, mergePortfolioContent, normalizeSlug, validatePortfolioContent, validatePortfolioForPublish, validatePortfolioTheme } from "@/utils/portfolio";
import { ensurePrefilledPortfolio } from "@/utils/portfolioProvisioning";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

class PortfolioConflictError extends Error {
  constructor() {
    super("PORTFOLIO_CONFLICT");
  }
}

function unauthorized() {
  return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
}

async function getOwner(req: NextRequest) {
  return await getSessionUser(req);
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
    const body = await req.json().catch(() => ({}));
    const result = await ensurePrefilledPortfolio(session.userId, {
      requestedSlug: typeof body.slug === "string" ? body.slug : "",
      templateKey: typeof body.templateKey === "string" ? body.templateKey : "minimal-pro",
    });
    return NextResponse.json(
      { success: true, portfolio: result.portfolio, created: result.created },
      { status: result.created ? 201 : 200 },
    );
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
    let contentForStatus: unknown = current.content;
    let syncedProfileImage: string | undefined;
    if (body.content !== undefined) {
      const contentError = validatePortfolioContent(body.content);
      if (contentError) return NextResponse.json({ success: false, message: contentError }, { status: 400 });
      const mergedContent = mergePortfolioContent(body.content);
      const previousContent = mergePortfolioContent(current.content);
      const previousProjects = new Map(previousContent.projects.map((project) => [project.id, project]));
      // Older payloads may omit visibility. New rows must still be private by
      // default; an explicit public value remains subject to the confirmation
      // checks below.
      const mergedContentForSave = {
        ...mergedContent,
        projects: mergedContent.projects.map((project) => (
          project.visibility === undefined && !previousProjects.has(project.id)
            ? { ...project, visibility: "private" as const }
            : project
        )),
      };
      const newlyPublicProjectIds = mergedContentForSave.projects
        .filter((project) => {
          if (project.visibility === "private") return false;
          const previous = previousProjects.get(project.id);
          if (!previous) return isPortfolioProjectMeaningful(project);
          return previous.visibility === "private"
            || (isBlankPortfolioProject(previous) && isPortfolioProjectMeaningful(project));
        })
        .map((project) => project.id);
      const confirmations = Array.isArray(body.confirmedPublicProjectIds)
        ? new Set(body.confirmedPublicProjectIds.filter((value: unknown): value is string => typeof value === "string"))
        : new Set<string>();
      const missingConfirmations = newlyPublicProjectIds.filter((projectId) => !confirmations.has(projectId));
      if (missingConfirmations.length > 0) {
        return NextResponse.json({
          success: false,
          code: "CASE_STUDY_PUBLICATION_CONFIRMATION_REQUIRED",
          caseStudyIds: missingConfirmations,
          message: "Confirm that this case study should be shown on your public portfolio before publishing it.",
        }, { status: 409 });
      }
      data.content = mergedContentForSave;
      contentForStatus = mergedContentForSave;
      syncedProfileImage = mergedContentForSave.profileImageUrl;
    }
    if (body.theme !== undefined) {
      const themeError = validatePortfolioTheme(body.theme);
      if (themeError) return NextResponse.json({ success: false, message: themeError }, { status: 400 });
      data.theme = { ...current.theme as object, ...body.theme };
    }
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
      if (body.status === "published") {
        const publishError = validatePortfolioForPublish(contentForStatus);
        if (publishError) return NextResponse.json({ success: false, message: publishError }, { status: 400 });
      }
      data.status = body.status;
      data.publishedAt = body.status === "published" ? new Date() : null;
    }

    await prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.portfolio.updateMany({
        where: { userId: session.userId, revision: current.revision },
        data,
      });
      if (updateResult.count !== 1) throw new PortfolioConflictError();
      if (syncedProfileImage !== undefined) {
        await transaction.user.update({
          where: { id: session.userId },
          data: { avatarUrl: syncedProfileImage || null },
        });
      }
    });
    const portfolio = await prisma.portfolio.findUnique({ where: { userId: session.userId } });
    if (!portfolio) throw new Error("Portfolio disappeared after save.");
    if (body.content !== undefined) {
      const savedContent = mergePortfolioContent(portfolio.content);
      const coreSignals = [
        Boolean(savedContent.name.trim()),
        Boolean(savedContent.headline.trim() && savedContent.bio.trim()),
        savedContent.services.some((service) => Boolean(service.title.trim())),
        savedContent.projects.some((project) => project.visibility !== "private" && Boolean(project.title.trim())),
        Boolean(savedContent.contactEmail.trim() || savedContent.location.trim()),
      ];
      if (coreSignals.filter(Boolean).length >= 4) {
        await recordActivationEvent(session.userId, ACTIVATION_EVENTS.profileSubstantiallyCompleted, {
          completedSignals: coreSignals.filter(Boolean).length,
        });
      }
    }
    if (body.status === "published") {
      await recordActivationEvent(session.userId, ACTIVATION_EVENTS.portfolioPublished, { portfolioId: portfolio.id });
      await recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.portfolioPublished, module: "portfolio", entityType: "portfolio", entityId: portfolio.id, dataOrigin: "user" });
    }
    return NextResponse.json({ success: true, portfolio });
  } catch (error) {
    if (error instanceof PortfolioConflictError) {
      return NextResponse.json({ success: false, message: "This portfolio changed in another tab. Reload before saving.", conflict: true }, { status: 409 });
    }
    console.error("Portfolio update error:", error);
    return NextResponse.json({ success: false, message: "Could not save portfolio." }, { status: 500 });
  }
}
