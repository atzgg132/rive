import "server-only";

import crypto from "crypto";
import { sanitizeAnalyticsPath } from "@/lib/route-privacy";

// One JSON object per line on stdout/stderr so the platform log collector can
// index it directly — CloudWatch Logs metric filters can then match top-level
// fields such as `metricName` without any parsing pipeline. No console.*: the
// record shape is the contract, and console formatting is not part of it.

export const REQUEST_ID_HEADER = "x-rive-request-id";
const REQUEST_ID_FALLBACK_HEADER = "x-request-id";
// Conservative inbound contract: anything else is caller-supplied markup and
// is never reflected back into logs or response headers.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export function getRequestId(request: Request): string {
  for (const header of [REQUEST_ID_HEADER, REQUEST_ID_FALLBACK_HEADER]) {
    const candidate = request.headers.get(header)?.trim() ?? "";
    if (REQUEST_ID_PATTERN.test(candidate)) return candidate;
  }
  return crypto.randomUUID();
}

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

const REDACTED = "[redacted]";
const MAX_STRING_LENGTH = 2000;
const MAX_DEPTH = 5;
const MAX_OBJECT_KEYS = 50;
const MAX_ARRAY_ITEMS = 20;

// Exact matches cover the short ambiguous names (a substring "to" would eat
// "photo"); substring matches cover the unambiguous credential words so
// "smtpPass", "ADMIN_TOTP_SECRET", and "accessToken" all collapse.
const SENSITIVE_EXACT_KEYS: ReadonlySet<string> = new Set([
  "to",
  "from",
  "pass",
  "auth",
  "session",
  "bearer",
  "otp",
]);
const SENSITIVE_KEY_PARTS: readonly string[] = [
  "password",
  "passwd",
  "passphrase",
  "pass",
  "secret",
  "token",
  "authorization",
  "cookie",
  "credential",
  "sessionid",
  "recipient",
  "email",
  "code",
  "key",
  "totp",
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return false;
  if (SENSITIVE_EXACT_KEYS.has(normalized)) return true;
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const BEARER_PATTERN = /\b(bearer|basic)\s+[A-Za-z0-9._~+/=:-]+/gi;
// Any scheme — smtps:// and postgres:// carry userinfo credentials just as
// often as https:// does, and non-http(s) URLs are dropped entirely anyway.
const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>()]+/gi;

/** Origin + privacy-scrubbed path only: query, fragment, and userinfo never survive. */
function sanitizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "[redacted-url]";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "[redacted-url]";
  return `${url.protocol}//${url.host}${sanitizeAnalyticsPath(url.pathname)}`;
}

function sanitizeString(value: string): string {
  let result = value.replace(URL_PATTERN, (match) => {
    const trailing = /[.,;:!?)\]]+$/.exec(match)?.[0] ?? "";
    return sanitizeUrl(match.slice(0, match.length - trailing.length)) + trailing;
  });
  result = result.replace(JWT_PATTERN, "[redacted-jwt]");
  result = result.replace(BEARER_PATTERN, "$1 [redacted]");
  result = result.replace(EMAIL_PATTERN, "[redacted-email]");
  // A whole-string path still gets token-route templating; embedded paths are
  // left alone because templating would mangle prose.
  if (result.startsWith("/") && !result.startsWith("//") && !/\s/.test(result)) {
    result = sanitizeAnalyticsPath(result);
  }
  if (result.length > MAX_STRING_LENGTH) result = `${result.slice(0, MAX_STRING_LENGTH)}…[truncated]`;
  return result;
}

/** Safe shape only — provider payloads, responses, and stacks stay out. */
function sanitizeError(error: Error, depth: number): Record<string, unknown> {
  const record: Record<string, unknown> = {
    name: sanitizeString(error.name || "Error"),
    message: sanitizeString(error.message || error.name || "Error"),
  };
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" || typeof code === "number") record.code = code;
  if (error.cause instanceof Error && depth + 1 < MAX_DEPTH) {
    record.cause = sanitizeError(error.cause, depth + 1);
  }
  return record;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return sanitizeError(value, depth);
  if (value instanceof URL) return sanitizeUrl(value.toString());
  if (value instanceof Headers) return REDACTED;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return "[binary]";
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[${value.length - MAX_ARRAY_ITEMS} more]`);
    return items;
  }
  const output: Record<string, unknown> = {};
  let count = 0;
  for (const [key, entry] of Object.entries(value)) {
    if (count >= MAX_OBJECT_KEYS) {
      output.__truncated__ = true;
      break;
    }
    count += 1;
    output[key] = isSensitiveKey(key) ? REDACTED : sanitizeValue(entry, depth + 1);
  }
  return output;
}

const RESERVED_KEYS: ReadonlySet<string> = new Set([
  "timestamp",
  "level",
  "event",
  "environment",
  "deployment",
  "metricname",
  "metricvalue",
]);

function emit(level: LogLevel, event: string, context?: LogContext, extra?: Record<string, unknown>): void {
  const record: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    event,
    environment: (process.env.APP_ENV || "local").toLowerCase(),
    deployment: process.env.DEPLOYMENT_VERSION || "local",
  };
  try {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (RESERVED_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""))) continue;
        record[key] = isSensitiveKey(key) ? REDACTED : sanitizeValue(value, 0);
      }
    }
    if (extra) Object.assign(record, extra);
  } catch {
    record.contextError = "sanitization_failed";
  }
  let line: string;
  try {
    line = JSON.stringify(record);
  } catch {
    line = JSON.stringify({ ...record, context: undefined, contextError: "serialization_failed" });
  }
  const stream = level === "warn" || level === "error" ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

export const logger = {
  debug: (event: string, context?: LogContext): void => emit("debug", event, context),
  info: (event: string, context?: LogContext): void => emit("info", event, context),
  warn: (event: string, context?: LogContext): void => emit("warn", event, context),
  error: (event: string, context?: LogContext): void => emit("error", event, context),
};

/** Emits `metricName`/`metricValue` at the top level for CloudWatch Logs metric filters. */
export function logMetric(name: string, value: number, context?: LogContext): void {
  emit("info", "metric", context, { metricName: name, metricValue: value });
}

/** Request-scoped fields safe to attach to any log line: no query, body, or raw IP. */
export function requestLogContext(request: Request): LogContext {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    pathname = request.url;
  }
  return {
    requestId: getRequestId(request),
    method: request.method,
    path: sanitizeAnalyticsPath(pathname),
  };
}
