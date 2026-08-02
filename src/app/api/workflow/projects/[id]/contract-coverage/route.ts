import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

const COVERAGE_OPTIONS = new Set(["undecided", "external", "none"]);

function clean(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanExternalUrl(value: unknown): string | null {
  const candidate = clean(value, 2_000);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = getSessionUser(request);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
    }

    const coverage = clean(body.coverage, 24).toLowerCase();
    if (!COVERAGE_OPTIONS.has(coverage)) {
      return NextResponse.json(
        { success: false, message: "Choose external, no contract needed, or decide later." },
        { status: 400 },
      );
    }

    const project = await prisma.project.findFirst({
      where: { id, userId: session.userId },
      select: {
        id: true,
        contracts: {
          where: { status: { not: "void" } },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!project) {
      return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
    }
    if (project.contracts.length > 0) {
      return NextResponse.json(
        { success: false, message: "This project already has a Rive contract. Its coverage is managed from that contract." },
        { status: 409 },
      );
    }

    const externalLabel = coverage === "external" ? clean(body.externalLabel, 180) || "Contract handled outside Rive" : null;
    const rawExternalUrl = clean(body.externalUrl, 2_000);
    const externalUrl = coverage === "external" ? cleanExternalUrl(rawExternalUrl) : null;
    if (coverage === "external" && rawExternalUrl && !externalUrl) {
      return NextResponse.json(
        { success: false, message: "External contract link must be a valid http or https URL." },
        { status: 400 },
      );
    }

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        contractCoverage: coverage,
        externalContractLabel: externalLabel,
        externalContractUrl: externalUrl,
        contractDecisionAt: coverage === "undecided" ? null : new Date(),
      },
      select: {
        id: true,
        contractCoverage: true,
        externalContractLabel: true,
        externalContractUrl: true,
        contractDecisionAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      coverage: {
        project_id: updated.id,
        status: updated.contractCoverage,
        external_label: updated.externalContractLabel,
        external_url: updated.externalContractUrl,
        decided_at: updated.contractDecisionAt,
      },
      message:
        coverage === "external"
          ? "Project marked as covered by an external contract."
          : coverage === "none"
            ? "Project marked as not requiring a contract."
            : "Contract decision left open.",
    });
  } catch (error) {
    console.error("Project contract coverage update error:", error);
    return NextResponse.json({ success: false, message: "Unable to update contract coverage." }, { status: 500 });
  }
}
