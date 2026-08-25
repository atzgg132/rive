import { NextRequest, NextResponse } from "next/server";
import { sendContactMessageEmail } from "@/utils/email";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { evaluatePublicFormGate, PUBLIC_FORM_RATE_LIMITS } from "@/utils/publicFormGate";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedSubjects = new Set([
  "General Inquiry",
  "Partnership",
  "Press",
  "Feedback",
  "Bug Report",
]);

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

  const body = await request.json().catch(() => null);
  const gate = evaluatePublicFormGate(body);
  // Same 200 a real send would return. No mail, no hint which check fired.
  if (!gate.ok) return accepted();

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (
    name.length < 2 ||
    name.length > 120 ||
    !emailPattern.test(email) ||
    email.length > 320 ||
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

  const result = await sendContactMessageEmail({ name, email, subject, message });
  if (!result.sent) {
    return NextResponse.json(
      { success: false, message: "Your message could not be delivered. Email hello@rive.work directly." },
      { status: 503 },
    );
  }

  return accepted();
}
