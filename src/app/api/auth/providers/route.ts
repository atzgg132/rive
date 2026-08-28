import { NextResponse } from "next/server";
import { googleLoginAvailable } from "@/utils/connectorConfig";

export async function GET() {
  const response = NextResponse.json({
    success: true,
    google: googleLoginAvailable(),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
