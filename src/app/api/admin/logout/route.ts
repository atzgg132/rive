import { NextResponse } from "next/server";

export async function POST() {
  // Since tokens are stateless and verify crytographically,
  // we just return success. Client will destroy it locally from sessionStorage.
  return NextResponse.json({ success: true });
}
