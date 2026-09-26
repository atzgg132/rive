import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { getReferralSummary } from "@/utils/referrals";

// Settings -> Referrals: the session user's code and launch-credit totals.
// Issues the code on first load and stamps any newly activated referrals.
export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const referrals = await getReferralSummary(session.userId);
  return NextResponse.json({ success: true, referrals });
}
