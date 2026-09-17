import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestId, REQUEST_ID_HEADER } from "@/utils/logger";

// API-only request ID plumbing. The validated ID is forwarded upstream as
// `x-rive-request-id` so route handlers can attach it to structured logs, and
// echoed back as `x-request-id`. Unsafe inbound IDs are replaced, never
// reflected. Deliberately no per-request logging here — route handlers opt in.
export function proxy(request: NextRequest): NextResponse {
  const requestId = getRequestId(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
