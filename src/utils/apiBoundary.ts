/**
 * Shared API boundary helpers for route handlers.
 *
 * Two concerns live here so every route enforces them identically:
 *
 * 1. `readJsonBody` — reads a JSON object request body under an absolute byte
 *    cap. Content-Length is checked first so an announced-oversized body is
 *    refused before any bytes are allocated; the streamed read then enforces
 *    the cap for callers that under-declare or omit the header. Oversized
 *    bodies get a 413, malformed or non-object JSON gets a 400.
 *
 * 2. Error responses — helper-produced errors keep the existing
 *    `{ success: false, message }` contract and add a stable `code` plus the
 *    request's `requestId` so a failure can be correlated with logs without
 *    ever echoing `error.message` (which leaks internals) back to the client.
 */

import { NextResponse } from "next/server";
import { getRequestId, logger, requestLogContext } from "@/utils/logger";

/** Default request-body ceiling: generous for every ordinary JSON mutation. */
export const API_BODY_DEFAULT_MAX_BYTES = 64 * 1024;

/**
 * Larger named cap for routes that legitimately accept big payloads. The
 * portfolio save endpoint is the only current user — a full portfolio
 * document can approach ~10 MB of JSON.
 */
export const API_BODY_LARGE_MAX_BYTES = 10_000_000;

export type JsonBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: NextResponse };

/** Build the shared `{ success:false, message, code, requestId }` error body. */
export function jsonErrorResponse(
  request: Request,
  status: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json(
    { success: false, message, code, requestId: getRequestId(request) },
    { status },
  );
}

/**
 * Convert an unexpected error into a generic 500 response. The real error is
 * logged through the sanitizing logger (name/message/code only, credentials
 * redacted); the client receives a static message — never `error.message`.
 */
export function internalErrorResponse(
  request: Request,
  event: string,
  error: unknown,
  message = "Internal server error.",
): NextResponse {
  logger.error(event, { ...requestLogContext(request), error });
  return jsonErrorResponse(request, 500, "internal_error", message);
}

class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeded the allowed byte cap.");
    this.name = "RequestBodyTooLargeError";
  }
}

/**
 * Read the full request body with an absolute byte cap. Throws
 * RequestBodyTooLargeError the moment the running total passes the cap so a
 * lying or missing Content-Length cannot force a full allocation.
 */
async function readBodyBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const stream = request.body;
  if (!stream) {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > maxBytes) throw new RequestBodyTooLargeError();
    return new Uint8Array(buffer);
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Read a JSON object body under `maxBytes` (default 64 KiB).
 *
 * - Declared Content-Length over the cap → 413 before a byte is read.
 * - Streamed bytes over the cap → 413 (catches absent/lying Content-Length).
 * - Malformed JSON, or JSON that is not a plain object → 400.
 * - `allowEmpty: true` treats an empty/whitespace body as `{}` for handlers
 *   whose fields are all optional; the default treats it as invalid.
 */
export async function readJsonBody(
  request: Request,
  options: { maxBytes?: number; allowEmpty?: boolean } = {},
): Promise<JsonBodyResult> {
  const maxBytes = options.maxBytes ?? API_BODY_DEFAULT_MAX_BYTES;

  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return {
      ok: false,
      response: jsonErrorResponse(request, 413, "request_body_too_large", "Request body is too large."),
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = await readBodyBytes(request, maxBytes);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return {
        ok: false,
        response: jsonErrorResponse(request, 413, "request_body_too_large", "Request body is too large."),
      };
    }
    return {
      ok: false,
      response: jsonErrorResponse(request, 400, "invalid_json", "Invalid JSON body."),
    };
  }

  const text = new TextDecoder().decode(bytes);
  if (!text.trim()) {
    if (options.allowEmpty) return { ok: true, body: {} };
    return {
      ok: false,
      response: jsonErrorResponse(request, 400, "invalid_json", "Invalid JSON body."),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      response: jsonErrorResponse(request, 400, "invalid_json", "Invalid JSON body."),
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      response: jsonErrorResponse(request, 400, "invalid_json", "Invalid JSON body."),
    };
  }

  return { ok: true, body: parsed as Record<string, unknown> };
}
