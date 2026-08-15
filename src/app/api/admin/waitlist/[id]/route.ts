import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { hasAdminSession } from "@/utils/adminSession";
import { getWaitlistOperationalDetails } from "@/utils/waitlistAdmin";

// The waitlist is a historical compatibility surface after open signup. It is
// deliberately read-only so an old admin bookmark cannot accidentally create
// invitations or mutate legacy approval state.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await hasAdminSession(req)) {
    return NextResponse.json({ success: false, message: "unauthorised." }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (Number.isNaN(id)) return NextResponse.json({ success: false, message: "invalid id." }, { status: 400 });

  const entry = await prisma.waitlist.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ success: false, message: "entry not found." }, { status: 404 });
  const details = (await getWaitlistOperationalDetails([entry.email])).get(entry.email.toLowerCase());

  return NextResponse.json({
    success: true,
    data: {
      ...entry,
      created_at: entry.createdAt,
      registered: details?.registered || false,
      registered_at: details?.registeredAt || null,
      invite_status: details?.registered ? "registered" : entry.status,
      invite_expires_at: details?.inviteExpiresAt || null,
      latest_delivery_status: details?.latestDeliveryStatus || null,
      latest_delivery_at: details?.latestDeliveryAt || null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  if (!await hasAdminSession(req)) {
    return NextResponse.json({ success: false, message: "unauthorised." }, { status: 401 });
  }
  return NextResponse.json({ success: false, code: "LEGACY_WAITLIST_READ_ONLY", message: "The legacy waitlist is read-only. Open signup is active." }, { status: 410 });
}

export async function POST(req: NextRequest) {
  return PATCH(req);
}
