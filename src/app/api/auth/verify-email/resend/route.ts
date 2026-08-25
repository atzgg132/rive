import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { prepareAuthToken } from "@/utils/authTokens";
import { buildEmailVerificationEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { getRequestIp } from "@/utils/rateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

export async function POST(req: NextRequest) {
  const genericResponse = () => NextResponse.json({ success: true, message: "If an account needs verification, a fresh link is on its way." });
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) return genericResponse();

    const ip = getRequestIp(req);
    const allowed = await durableRateLimit(`auth:verify-resend:${hashRequestValue(ip)}:${hashRequestValue(email)}`, 3, 15 * 60 * 1000);
    if (!allowed) return genericResponse();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, emailVerifiedAt: true, emailVerificationRequiredAt: true },
    });
    if (!user || user.emailVerifiedAt || !user.emailVerificationRequiredAt) return genericResponse();

    const prepared = prepareAuthToken({ email: user.email, type: "email_verification", userId: user.id });
    const emailPayload = buildEmailVerificationEmail(user.email, user.name || "there", prepared.token);
    const outboxId = await prisma.$transaction(async (tx) => {
      await tx.authToken.updateMany({ where: { userId: user.id, type: "email_verification", usedAt: null }, data: { usedAt: new Date() } });
      await tx.authToken.create({ data: prepared.data });
      const jobId = await enqueueEmail(emailPayload, tx);
      await recordProductEvent({
        userId: user.id,
        eventName: PRODUCT_EVENTS.emailVerificationSent,
        module: "auth",
        properties: { delivery: "outbox", reason: "resend" },
      }, tx);
      return jobId;
    });
    if (getEmailProvider() !== "disabled") await processEmailOutbox({ jobId: outboxId });
    return genericResponse();
  } catch (error) {
    console.error("Verification resend error:", error);
    return genericResponse();
  }
}
