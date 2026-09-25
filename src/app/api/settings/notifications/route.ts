import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { readJsonBody } from "@/utils/apiBoundary";

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  if (typeof body.loginAlertsEnabled !== "boolean") {
    return NextResponse.json({ success: false, message: "loginAlertsEnabled must be true or false." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { loginAlertsEnabled: body.loginAlertsEnabled },
    select: { loginAlertsEnabled: true },
  });
  return NextResponse.json({ success: true, user });
}
