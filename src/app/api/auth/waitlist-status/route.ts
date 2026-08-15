import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    status: "open_signup",
    message: "Rive is open for signup. Create an account and verify your email to start."
  }, { status: 410 });
}
