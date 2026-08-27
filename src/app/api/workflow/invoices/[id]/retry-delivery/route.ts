import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getEmailProvider } from "@/utils/email";
import { processEmailOutbox } from "@/utils/emailOutbox";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    const delivery = await prisma.invoiceDelivery.findFirst({
      where: {
        invoiceId: id,
        status: "failed",
        invoice: {
          userId: session.userId,
          status: { in: ["sent", "viewed", "overdue"] },
          publicTokenHash: { not: null },
          sentSnapshot: { not: Prisma.JsonNull },
        },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!delivery) {
      return NextResponse.json({ success: false, message: "No failed invoice email is available to retry." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      const outbox = await tx.emailOutbox.updateMany({
        where: { id: delivery.id, status: "failed" },
        data: { status: "queued", attempts: 0, availableAt: new Date(), lastError: null, processedAt: null },
      });
      const audit = await tx.invoiceDelivery.updateMany({
        where: { id: delivery.id, status: "failed" },
        data: { status: "queued", providerMessageId: null, error: "queued_for_retry" },
      });
      if (outbox.count !== 1 || audit.count !== 1) throw new Error("The failed delivery changed before it could be retried.");
    });

    let delivered = false;
    if (getEmailProvider() !== "disabled") {
      const result = await processEmailOutbox({ jobId: delivery.id }).catch((error) => {
        console.error("Immediate invoice delivery retry failed:", error);
        return null;
      });
      delivered = Boolean(result && result.sent > 0);
    }

    return NextResponse.json({
      success: true,
      delivered,
      message: delivered ? "Invoice email delivered." : "Invoice email queued for retry.",
    });
  } catch (error) {
    console.error("Invoice delivery retry error:", error);
    const message = error instanceof Error && error.message.includes("changed before")
      ? error.message
      : "Unable to retry invoice delivery.";
    return NextResponse.json({ success: false, message }, { status: message.includes("changed before") ? 409 : 500 });
  }
}
