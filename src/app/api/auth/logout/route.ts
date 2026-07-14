import { NextResponse } from "next/server";
import { TOKEN_COOKIE_NAME } from "@/utils/userAuth";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully."
  });

  // Clear cookie
  response.cookies.set({
    name: TOKEN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    expires: new Date(0),
    path: "/"
  });

  return response;
}
