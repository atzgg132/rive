import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", {
      next: { revalidate: 30 } // Cache results on Vercel Edge for 30s to maximize speed
    });
    if (!res.ok) throw new Error("Frankfurter API response not ok");
    
    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("Failed to proxy currency rates:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not load rates." }, { status: 502 });
  }
}
