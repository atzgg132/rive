import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { verifyToken } from "@/utils/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("x-admin-token");
  if (!verifyToken(token)) {
    return NextResponse.json({ success: false, message: "unauthorised." }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: "invalid id." }, { status: 400 });
    }

    const { status } = await req.json();
    if (status !== "approved" && status !== "pending") {
      return NextResponse.json(
        { success: false, message: "status must be 'approved' or 'pending'." },
        { status: 400 }
      );
    }

    const updated = await prisma.waitlist.update({
      where: { id },
      data: { status }
    });

    if (status === "approved") {
      // Mock Email Sender
      console.log(`\n\n=== ✉️ MOCK EMAIL SENT TO ${updated.email} ===`);
      console.log(`Subject: Welcome to Rive! Your Waitlist is Approved.`);
      console.log(`Body:\nHey there!\nWe're thrilled to inform you that you have been approved from the waitlist.\nYou can now set up your account by visiting the Register page and entering this email address to verify your status.\n\nNext Steps:\n1. Go to https://rive.app/register\n2. Create your secure password.\n3. Enter your dashboard.\n\nWelcome to the Freelance OS,\nThe Rive Team`);
      console.log(`=========================================\n\n`);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error("Waitlist update error:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ success: false, message: "entry not found." }, { status: 404 });
    }
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
