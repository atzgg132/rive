import crypto from "crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { syncGoogleCalendar } from "@/utils/googleCalendar";
import { googleCalendarAvailable } from "@/utils/connectorConfig";

function tokensMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  // Compare against a fixed-length buffer first so a length mismatch never
  // short-circuits into a variable-time comparison.
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

export async function POST(req: NextRequest) {
  if (!googleCalendarAvailable()) return new NextResponse(null, { status: 404 });
  const channelId = req.headers.get("x-goog-channel-id") || "";
  const channelToken = req.headers.get("x-goog-channel-token") || "";
  const resourceId = req.headers.get("x-goog-resource-id") || "";
  const channel = await prisma.calendarWebhookChannel.findUnique({ where: { id: channelId } });
  if (!channel || !tokensMatch(channel.channelToken, channelToken) || channel.resourceId !== resourceId) {
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
