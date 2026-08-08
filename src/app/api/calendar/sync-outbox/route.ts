import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { pushEventToGoogle } from "@/utils/googleCalendar";
import { googleCalendarAvailable } from "@/utils/connectorConfig";

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  if (!googleCalendarAvailable()) return NextResponse.json({ success: true, disabled: true, claimed: 0, processed: 0 });
  const jobs = await prisma.calendarSyncOutbox.findMany({
    where: { status: "pending", availableAt: { lte: new Date() }, attempts: { lt: 8 } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  let processed = 0;
  for (const job of jobs) {
    if (!job.eventId || job.provider !== "google") continue;
    const claimed = await prisma.calendarSyncOutbox.updateMany({
      where: { id: job.id, status: "pending" },
      data: { status: "processing", attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;
    try {
      await pushEventToGoogle(job.eventId, job.operation as "create" | "update" | "delete");
      await prisma.calendarSyncOutbox.update({ where: { id: job.id }, data: { status: "completed", processedAt: new Date(), lastError: null } });
      processed += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      await prisma.calendarSyncOutbox.update({
        where: { id: job.id },
        data: {
          status: "pending",
          availableAt: new Date(Date.now() + Math.min(6 * 60 * 60 * 1000, 2 ** attempts * 30_000)),
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Sync failed",
        },
      });
    }
  }
  return NextResponse.json({ success: true, claimed: jobs.length, processed });
}
