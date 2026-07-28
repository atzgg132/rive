import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { eventsToIcs, getCalendarEvents, hashSubscriptionToken } from "@/utils/calendar";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const subscription = await prisma.calendarSubscription.findUnique({
    where: { tokenHash: hashSubscriptionToken(token) },
    select: { userId: true, revokedAt: true },
  });
  if (!subscription || subscription.revokedAt) {
    return new NextResponse("Calendar feed not found.", { status: 404 });
  }
  const start = new Date();
  start.setUTCMonth(start.getUTCMonth() - 3);
  const end = new Date();
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  const events = await getCalendarEvents(subscription.userId, start, end);
  return new NextResponse(eventsToIcs(events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="rive-calendar.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
