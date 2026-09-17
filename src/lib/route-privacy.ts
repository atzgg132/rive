const PARSING_ORIGIN = "https://route-privacy.invalid";
const MAX_LENGTH = 500;

export const SENSITIVE_ANALYTICS_PATHS = [
  "/sign/[token]",
  "/review/[token]",
  "/invoice/[token]",
  "/api/public/invoices/[token]",
  "/api/public/contracts/review/[token]",
  "/api/public/contracts/sign/[token]",
  "/api/public/contracts/artifact/[token]",
  "/api/public/contracts/void/[token]",
] as const;

const SENSITIVE_ANALYTICS_PATH_SET: ReadonlySet<string> = new Set(SENSITIVE_ANALYTICS_PATHS);

const TOKEN_ROUTE_TEMPLATES: ReadonlyArray<{ readonly base: string; readonly template: string }> = [
  { base: "/sign", template: "/sign/[token]" },
  { base: "/review", template: "/review/[token]" },
  { base: "/invoice", template: "/invoice/[token]" },
  { base: "/api/public/invoices", template: "/api/public/invoices/[token]" },
  { base: "/api/public/contracts/review", template: "/api/public/contracts/review/[token]" },
  { base: "/api/public/contracts/sign", template: "/api/public/contracts/sign/[token]" },
  { base: "/api/public/contracts/artifact", template: "/api/public/contracts/artifact/[token]" },
  { base: "/api/public/contracts/void", template: "/api/public/contracts/void/[token]" },
];

function matchTokenRoute(pathname: string): string | null {
  for (const { base, template } of TOKEN_ROUTE_TEMPLATES) {
    if (pathname.startsWith(`${base}/`)) return template;
  }
  return null;
}

export function sanitizeAnalyticsPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  let pathname: string;
  try {
    const url = new URL(value, PARSING_ORIGIN);
    if (url.origin !== PARSING_ORIGIN) return "/";
    pathname = url.pathname;
  } catch {
    return "/";
  }
  return (matchTokenRoute(pathname) ?? pathname).slice(0, MAX_LENGTH);
}

export function sanitizeAnalyticsReferrer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const safePath = sanitizeAnalyticsPath(url.pathname);
  return `${url.protocol}//${url.hostname}${safePath}`.slice(0, MAX_LENGTH);
}

export function isSensitiveAnalyticsPath(value: unknown): boolean {
  return SENSITIVE_ANALYTICS_PATH_SET.has(sanitizeAnalyticsPath(value));
}
