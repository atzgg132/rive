import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { readJsonBody } from "@/utils/apiBoundary";

/** Pause or resume automated reminders for one invoice, scoped to the owner. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const paused = (parsedBody.body as { paused?: unknown }).paused;
  if (typeof paused !== "boolean") {
    return NextResponse.json({ success: false, message: "paused must be a boolean." }, { status: 400 });
  }

  const updated = await prisma.invoice.updateMany({
    where: { id, userId: session.userId },
    data: { remindersPaused: paused },
  });
  if (updated.count !== 1) return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });

  return NextResponse.json({ success: true, remindersPaused: paused });
}
