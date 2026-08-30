/** First value from a Next.js searchParams entry. */
export function firstSearchParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

/**
 * Same-origin relative paths only. Rejects protocol-relative URLs, schemes,
 * backslashes, and anything the URL parser would resolve off-origin.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return null;
  if (trimmed.includes("\\") || trimmed.includes("://")) return null;
  if (/^[a-zA-Z][a-zA-Z+.-]*:/u.test(trimmed)) return null;

  try {
    const url = new URL(trimmed, "https://www.rive.work");
    if (url.origin !== "https://www.rive.work") return null;
    if (url.username || url.password) return null;
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (!path.startsWith("/") || path.startsWith("//")) return null;
    return path;
  } catch {
    return null;
  }
}

/** A safe migration destination, including an immutable session query. */
export function safeMigrationNextPath(value: string | null | undefined): string | null {
  const path = safeNextPath(value);
  if (!path) return null;
  const url = new URL(path, "https://www.rive.work");
  return url.pathname === "/migrate" ? path : null;
}

/** Honor `next` only after onboarding is done (API sent the operator to the dashboard). */
export function resolveLoginDestination(
  apiDestination: string | null | undefined,
  nextCandidate: string | null | undefined,
): string {
  const destination = apiDestination || "/dashboard";
  const migrationPath = safeMigrationNextPath(nextCandidate);
  if (migrationPath) return migrationPath;
  if (destination !== "/dashboard") return destination;
  return safeNextPath(nextCandidate) || destination;
}
