import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { syncGoogleCalendar } from "@/utils/googleCalendar";

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("x-goog-channel-id") || "";
  const channelToken = req.headers.get("x-goog-channel-token") || "";
  const resourceId = req.headers.get("x-goog-resource-id") || "";
  const channel = await prisma.calendarWebhookChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.channelToken !== channelToken || channel.resourceId !== resourceId) {
    return new NextResponse(null, { status: 404 });
  }
  after(async () => {
    try {
      await syncGoogleCalendar(channel.externalCalendarId);
    } catch (error) {
      console.error("Google webhook synchronization failed:", error);
    }
  });
  return new NextResponse(null, { status: 204 });
}
