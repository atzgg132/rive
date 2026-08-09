import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { createDefaultContractSections } from "@/utils/contracts";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId")?.trim() || "";
    const projectId = searchParams.get("projectId")?.trim() || "";
    if (!clientId) {
      return NextResponse.json({ success: false, message: "Choose a client to prepare the contract draft." }, { status: 400 });
    }

    const [owner, client, project] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, email: true, currency: true },
      }),
      prisma.client.findFirst({
        where: { id: clientId, userId: session.userId },
        select: { id: true, name: true, email: true, company: true, address: true, status: true },
      }),
      projectId
        ? prisma.project.findFirst({
            where: { id: projectId, userId: session.userId },
            select: {
              id: true,
              title: true,
              description: true,
              clientId: true,
              currency: true,
              budget: true,
              dueDate: true,
              milestones: {
                orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
                select: { id: true, title: true, dueDate: true, completed: true },
              },
            },
          })
        : Promise.resolve(null),
    ]);

    if (!owner || !client) {
      return NextResponse.json({ success: false, message: "Client not found or unauthorized." }, { status: 404 });
    }
    if (projectId && !project) {
      return NextResponse.json({ success: false, message: "Project not found or unauthorized." }, { status: 404 });
    }
    if (project && project.clientId !== client.id) {
      return NextResponse.json({ success: false, message: "The selected project belongs to another client." }, { status: 409 });
    }

    const ownerName = owner.name || owner.email;
    const sections = createDefaultContractSections({ ownerName, clientName: client.name }).map((section) =>
      section.key === "scope" && project?.description?.trim()
        ? {
            ...section,
            body: `${ownerName} will provide the services and deliverables described in the linked project brief:\n\n${project.description.trim()}\n\nWork outside this scope requires a written change agreed by both parties.`,
          }
        : section,
    );

    return NextResponse.json({
      success: true,
      template: {
        title: project ? `${project.title} — Services agreement` : `${client.name} — Services agreement`,
        currency: project?.currency || owner.currency || "USD",
        governing_law: "India",
        jurisdiction: "",
        sections,
        owner: { name: ownerName, email: owner.email },
        client,
        project: project
          ? {
              id: project.id,
              title: project.title,
              description: project.description,
              budget: project.budget?.toString() || null,
              currency: project.currency,
              due_date: project.dueDate,
              milestones: project.milestones.map((milestone) => ({
                id: milestone.id,
                title: milestone.title,
                due_date: milestone.dueDate,
                completed: milestone.completed,
              })),
            }
          : null,
        readiness: {
          can_share_for_review: Boolean(client.email),
          can_start_signing: Boolean(client.email),
          notices: [
            ...(!client.email ? ["Add the client email before sharing or signing."] : []),
            ...(!client.company ? ["Client company or legal entity is not recorded; confirm the named party before signing."] : []),
            ...(!client.address ? ["Client address is not recorded; add it if the agreement or local law requires one."] : []),
            "Confirm governing law, jurisdiction, signer authority, taxes, and any transaction-specific formalities before finalizing.",
          ],
        },
      },
    });
  } catch (error) {
    console.error("Contract template error:", error);
    return NextResponse.json({ success: false, message: "Unable to prepare the contract draft." }, { status: 500 });
  }
}
