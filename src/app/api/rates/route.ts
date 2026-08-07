import { NextResponse } from "next/server";
import { getExchangeRateSnapshot } from "@/utils/exchangeRates";

export async function GET() {
  const snapshot = await getExchangeRateSnapshot();
  if (!snapshot) {
    return NextResponse.json({ success: false, error: "Could not load exchange rates." }, { status: 503 });
  }
  const rates = Object.fromEntries(Object.entries(snapshot.rates).filter(([currency]) => currency !== "USD"));
  return NextResponse.json({
    success: true,
    data: { amount: 1, base: "USD", date: snapshot.asOf, rates },
  });
}
