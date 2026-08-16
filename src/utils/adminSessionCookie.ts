// Cookie scope policy for the admin session.
//
// This is deliberately free of `server-only` and `next/server` imports so the
// path contract can be asserted directly in the no-DB domain tests. The scope of
// this cookie is not cosmetic: it decides whether an authenticated admin stays
// authenticated, so it gets a test rather than a comment alone.

export const ADMIN_SESSION_COOKIE = "rive_admin_session";

// The session must accompany the /admin page *and* every /api/admin/* request.
// "/api/admin/..." does not path-match a cookie scoped to "/admin", so scoping it
// there meant the browser stored the session and then withheld it from the very
// endpoints that validate it.
export const ADMIN_SESSION_COOKIE_PATH = "/";

// Sessions issued before the scope fix are parked here and would otherwise linger
// for a full TTL, shadowing the correctly scoped cookie on /admin requests.
export const LEGACY_ADMIN_SESSION_COOKIE_PATH = "/admin";

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * RFC 6265 section 5.1.4 path-match: a cookie is sent only when its path is the
 * request path, or a prefix of it ending at a "/" boundary. "/admin" therefore
 * covers "/admin/settings" but never "/api/admin/session".
 */
export function cookiePathMatches(cookiePath: string, requestPath: string): boolean {
  if (cookiePath === requestPath) return true;
  if (!requestPath.startsWith(cookiePath)) return false;
  return cookiePath.endsWith("/") || requestPath.charAt(cookiePath.length) === "/";
}
