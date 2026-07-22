import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function PATCH(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, message: "Project ID and status are required." }, { status: 400 });
    }

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ success: false, message: "Not found or unauthorized." }, { status: 404 });
    }

    const project = await prisma.project.update({
      where: { id },
      data: { status }
    });

    return NextResponse.json({
      success: true,
      message: "Project status updated successfully.",
      project
    }, { status: 200 });
  } catch (error: unknown) {
    console.error("Project status update error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
