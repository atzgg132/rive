const FIRST_PARTY_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Portfolio analytics should report acquisition sources, not navigation inside
 * Rive. Keep only the external origin so paths from a portfolio or case study
 * cannot appear as separate "sources".
 */
export function normalizePortfolioReferrer(value: string | null | undefined): string | null {
  const input = value?.trim();
  if (!input) return null;

  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (FIRST_PARTY_HOSTS.has(hostname) || hostname === "rive.work" || hostname.endsWith(".rive.work")) return null;

    return url.origin;
  } catch {
    return null;
  }
}
