import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { watchGoogleCalendar } from "@/utils/googleCalendar";
import { googleCalendarAvailable } from "@/utils/connectorConfig";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  if (!googleCalendarAvailable()) return NextResponse.json({ success: true, disabled: true, checked: 0, renewed: 0, failed: 0 });

  const renewBefore = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const selectedCalendars = await prisma.externalCalendar.findMany({
    where: {
      selected: true,
      connection: { provider: "google", status: "connected" },
    },
    select: {
      id: true,
      connection: {
        select: {
          webhookChannels: {
            select: { externalCalendarId: true, expiresAt: true },
          },
        },
      },
    },
    take: 100,
  });
  const calendars = selectedCalendars.filter((calendar) => {
    const channels = calendar.connection.webhookChannels.filter(
      (channel) => channel.externalCalendarId === calendar.id,
    );
    return channels.length === 0 || channels.every((channel) => channel.expiresAt <= renewBefore);
  });

  let renewed = 0;
  const failures: string[] = [];
  for (const calendar of calendars) {
    try {
      const channelId = await watchGoogleCalendar(calendar.id);
      if (!channelId) continue;
      await prisma.calendarWebhookChannel.deleteMany({
        where: {
          externalCalendarId: calendar.id,
          id: { not: channelId },
        },
      });
      renewed += 1;
    } catch (error) {
      console.error("Google Calendar webhook renewal failed:", error);
      failures.push(calendar.id);
    }
  }

  await prisma.calendarWebhookChannel.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return NextResponse.json({
    success: failures.length === 0,
    checked: calendars.length,
    renewed,
    failed: failures.length,
  });
}
