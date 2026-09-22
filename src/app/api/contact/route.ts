import { NextRequest, NextResponse } from "next/server";
import { buildContactMessageEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { prisma } from "@/utils/db";
import { logger, requestLogContext } from "@/utils/logger";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { evaluatePublicFormGate, PUBLIC_FORM_RATE_LIMITS } from "@/utils/publicFormGate";
import { normalizeEmailAddress } from "@/lib/email-address";
import { readJsonBody } from "@/utils/apiBoundary";
import { CONTACT_SUBJECTS } from "@/content/marketing/resources";

const allowedSubjects = new Set<string>(CONTACT_SUBJECTS);

const limits = PUBLIC_FORM_RATE_LIMITS.contact;

function accepted() {
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const throttled = NextResponse.json(
    { success: false, message: "Too many messages. Please try again later." },
    { status: 429 },
  );

  /* Public, unauthenticated, and it sends mail from our own domain, so this
     belongs on the durable limiter. Every message lands in the same inbox, so
     the global ceiling is what bounds the flood; the per-IP one only stops a
     single source from consuming it. */
  if (!await durableRateLimit("contact:global", limits.global.limit, limits.global.windowMs)) return throttled;
  if (!await durableRateLimit(`contact:${hashRequestValue(ip)}`, limits.ip.limit, limits.ip.windowMs)) return throttled;

  const parsedBody = await readJsonBody(request, { allowEmpty: true });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
  const gate = evaluatePublicFormGate(body);
  // Same 200 a real send would return. No mail, no hint which check fired.
  if (!gate.ok) return accepted();

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = normalizeEmailAddress(body?.email) || "";
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (
    name.length < 2 ||
    name.length > 120 ||
    !email ||
    !allowedSubjects.has(subject) ||
    message.length < 10 ||
    message.length > 5_000
  ) {
    return NextResponse.json(
      { success: false, message: "Please review the form and try again." },
      { status: 400 },
    );
  }

  if (!await durableRateLimit(`contact:email:${hashRequestValue(email)}`, limits.email.limit, limits.email.windowMs)) {
    return throttled;
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) || null;
  const queued = await prisma.$transaction(async (tx) => {
    const record = await tx.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message,
        ipHash: hashRequestValue(ip),
        userAgent,
      },
      select: { id: true },
    });
    const outboxId = await enqueueEmail(buildContactMessageEmail({ name, email, subject, message }), tx);
    await tx.contactMessage.update({ where: { id: record.id }, data: { outboxId } });
    return { id: record.id, outboxId };
  });

  if (getEmailProvider() !== "disabled") {
    const context = requestLogContext(request);
    await processEmailOutbox({ jobId: queued.outboxId }).catch((error) => {
      logger.warn("contact_message_delivery_deferred", { ...context, error });
    });
  }

  return accepted();
}
