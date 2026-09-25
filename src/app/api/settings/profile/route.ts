import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { readJsonBody } from "@/utils/apiBoundary";
import { validateBusinessTypes } from "@/lib/settingsDomain";
import { isValidOnboardingAvatarUrl, mergePortfolioContent } from "@/utils/portfolio";

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 120);
    if (!name) return NextResponse.json({ success: false, message: "Name is required." }, { status: 400 });
    data.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "profession")) {
    if (body.profession !== null && typeof body.profession !== "string") {
      return NextResponse.json({ success: false, message: "Profession must be text." }, { status: 400 });
    }
    data.profession = typeof body.profession === "string" ? body.profession.trim().slice(0, 120) || null : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "businessTypes")) {
    const businessTypes = validateBusinessTypes(body.businessTypes);
    if (!businessTypes) return NextResponse.json({ success: false, message: "Choose at least one supported business type." }, { status: 400 });
    data.businessTypes = businessTypes;
    data.businessType = businessTypes[0];
  }
  if (Object.prototype.hasOwnProperty.call(body, "avatarUrl")) {
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : "";
    if (avatarUrl && !isValidOnboardingAvatarUrl(avatarUrl)) {
      return NextResponse.json({ success: false, message: "Profile photo must be a supported upload or HTTPS URL under 1.8 MB." }, { status: 400 });
    }
    data.avatarUrl = avatarUrl || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, message: "Nothing to save." }, { status: 400 });
  }

  const user = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.update({
      where: { id: session.userId },
      data,
      select: { id: true, name: true, profession: true, businessType: true, businessTypes: true, avatarUrl: true },
    });
    if (data.avatarUrl !== undefined) {
      const portfolio = await transaction.portfolio.findUnique({ where: { userId: session.userId } });
      if (portfolio) {
        const content = mergePortfolioContent(portfolio.content);
        await transaction.portfolio.update({
          where: { userId: session.userId },
          data: {
            content: {
              ...content,
              profileImageUrl: updated.avatarUrl || "",
              profileImageSourceUrl: updated.avatarUrl || "",
            },
            revision: { increment: 1 },
          },
        });
      }
    }
    return updated;
  });

  return NextResponse.json({ success: true, user });
}
