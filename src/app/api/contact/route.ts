import { NextRequest, NextResponse } from "next/server";
import { sendContactMessageEmail } from "@/utils/email";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedSubjects = new Set([
  "General Inquiry",
  "Partnership",
  "Press",
  "Feedback",
  "Bug Report",
]);

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  if (!rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { success: false, message: "Too many messages. Please try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
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

  const result = await sendContactMessageEmail({ name, email, subject, message });
  if (!result.sent) {
    return NextResponse.json(
      { success: false, message: "Your message could not be delivered. Email hello@rive.work directly." },
      { status: 503 },
    );
  }

  return NextResponse.json({ success: true });
}
