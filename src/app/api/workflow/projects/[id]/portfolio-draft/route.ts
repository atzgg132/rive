import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ensurePrefilledPortfolio } from "@/utils/portfolioProvisioning";
import {
  buildPortfolioCaseStudyFromProject,
  isBlankPortfolioProject,
  isProjectProofEligible,
  mergeGeneratedPortfolioCaseStudy,
  mergePortfolioContent,
  projectCaseStudyId,
  projectProofOffer,
} from "@/utils/portfolio";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: { id, userId: session.userId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        updatedAt: true,
        tags: true,
        client: { select: { name: true, company: true } },
        milestones: { orderBy: { createdAt: "asc" }, select: { title: true, completed: true, completedAt: true } },
      },
    });
    if (!project) return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
    if (!isProjectProofEligible(project)) {
      return NextResponse.json({ success: false, message: "Complete the Project or at least one milestone before creating a case study draft." }, { status: 409 });
    }

    const initial = await ensurePrefilledPortfolio(session.userId);
    let current = initial.portfolio;
    const generated = buildPortfolioCaseStudyFromProject(project);
    const caseStudyId = projectCaseStudyId(project.id);
    let entry = generated;
    let action: "created" | "updated" | "unchanged" = "created";
    let saved = false;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const content = mergePortfolioContent(current.content);
      const existingIndex = content.projects.findIndex((item) => item.id === caseStudyId);
      if (existingIndex >= 0) {
        entry = content.projects[existingIndex];
        if (entry.visibility === "public") {
          action = "unchanged";
          saved = true;
          break;
        }
        const merged = mergeGeneratedPortfolioCaseStudy(entry, generated);
        if (JSON.stringify(merged) === JSON.stringify(entry)) {
          action = "unchanged";
          saved = true;
          break;
        }
        const nextProjects = [...content.projects];
        nextProjects[existingIndex] = merged;
        entry = merged;
        action = "updated";
        const update = await prisma.portfolio.updateMany({
          where: { userId: session.userId, revision: current.revision },
          data: { content: { ...content, projects: nextProjects } as unknown as Prisma.InputJsonValue, revision: current.revision + 1 },
        });
        if (update.count === 1) {
          saved = true;
          break;
        }
      } else {
        const starterIndex = content.projects.findIndex(isBlankPortfolioProject);
        const nextProjects = [...content.projects];
        if (starterIndex >= 0) nextProjects[starterIndex] = generated;
        else nextProjects.push(generated);
        entry = generated;
        action = "created";
        const update = await prisma.portfolio.updateMany({
          where: { userId: session.userId, revision: current.revision },
          data: { content: { ...content, projects: nextProjects } as unknown as Prisma.InputJsonValue, revision: current.revision + 1 },
        });
        if (update.count === 1) {
          saved = true;
          break;
        }
      }
      const latest = await prisma.portfolio.findUnique({ where: { userId: session.userId } });
      if (!latest) break;
      current = latest;
    }

    if (!saved) return NextResponse.json({ success: false, message: "The Portfolio changed while the draft was being created. Reload and try again.", conflict: true }, { status: 409 });
    const portfolio = await prisma.portfolio.findUnique({ where: { userId: session.userId } });
    if (!portfolio) return NextResponse.json({ success: false, message: "Portfolio not found after draft creation." }, { status: 500 });
    if (action !== "unchanged") {
      await recordProductEvent({
        userId: session.userId,
        eventName: PRODUCT_EVENTS.portfolioCaseStudyDraftCreated,
        module: "portfolio",
        entityType: "portfolio_project",
        entityId: caseStudyId,
        dataOrigin: "user",
        source: "project_completion",
        dedupeKey: `portfolio_case_study_draft_created:${session.userId}:${caseStudyId}`,
        properties: { projectId: project.id, action },
      });
    }
    return NextResponse.json({
      success: true,
      action,
      entry,
      portfolioRevision: portfolio.revision,
      proof_offer: projectProofOffer(project.id),
      href: projectProofOffer(project.id).href,
    });
  } catch (error) {
    console.error("Portfolio case study draft error:", error);
    return NextResponse.json({ success: false, message: "Unable to create the case study draft." }, { status: 500 });
  }
}
