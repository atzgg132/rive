import { NextResponse } from "next/server";
import { getExchangeRateSnapshot } from "@/utils/exchangeRates";

export async function GET() {
  const snapshot = await getExchangeRateSnapshot();
  if (!snapshot) {
    // Exchange rates are an optional enhancement. Keep the failure in-band so
    // dashboard pages can render their explicit unavailable state without
    // turning a non-critical upstream outage into a browser 5xx error.
    return NextResponse.json(
      { success: false, error: "Exchange rates are temporarily unavailable." },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const rates = Object.fromEntries(Object.entries(snapshot.rates).filter(([currency]) => currency !== "USD"));
  return NextResponse.json({
    success: true,
    data: { amount: 1, base: "USD", date: snapshot.asOf, rates },
  });
}
