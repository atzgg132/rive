import { NextRequest, NextResponse } from "next/server";
import { generateToken } from "@/utils/auth";

const ADMIN_USERNAME = "Admin1";
const ADMIN_PASSWORD = "AdminPass1";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = generateToken();
      return NextResponse.json({ success: true, token });
    }
    return NextResponse.json({ success: false, message: "invalid credentials." }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, message: "bad request." }, { status: 400 });
  }
}
