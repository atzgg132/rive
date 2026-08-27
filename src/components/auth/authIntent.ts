export type AuthView = "login" | "register" | "forgot";

export type AuthParams = {
  email: string;
  next: string;
  invite: string;
  goal: string;
};

export const AUTH_PATHS: Record<AuthView, string> = {
  login: "/login",
  register: "/register",
  forgot: "/forgot-password",
};

export const emptyAuthParams: AuthParams = {
  email: "",
  next: "",
  invite: "",
  goal: "",
};

export function authViewFromPathname(pathname: string): AuthView | null {
  if (pathname === "/login") return "login";
  if (pathname === "/register") return "register";
  if (pathname === "/forgot-password") return "forgot";
  return null;
}

export function authViewFromSearch(search: string): AuthView | null {
  const value = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("auth");
  if (value === "login" || value === "register" || value === "forgot") return value;
  return null;
}

export function readAuthParams(search: string): AuthParams {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    email: params.get("email") || "",
    next: params.get("next") || "",
    invite: params.get("invite") || "",
    goal: params.get("goal") || "",
  };
}

export function isAppShellPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/workflow") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/portfolio") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/migrate") ||
    pathname.startsWith("/admin")
  );
}

export function isMarketingSurface(pathname: string): boolean {
  if (authViewFromPathname(pathname)) return true;
  if (isAppShellPath(pathname)) return false;
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/p/")) return false;
  if (pathname.startsWith("/review/")) return false;
  if (pathname.startsWith("/sign/")) return false;
  if (pathname.startsWith("/invoice/")) return false;
  if (pathname.startsWith("/reset-password")) return false;
  if (pathname.startsWith("/verify-email")) return false;
  if (pathname.startsWith("/portfolio-preview")) return false;
  return true;
}

export function parseAuthHref(href: string, origin: string): { view: AuthView; params: AuthParams } | null {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const view = authViewFromPathname(url.pathname);
  if (!view) return null;
  return { view, params: readAuthParams(url.search) };
}

export function mergeAuthParams(base: AuthParams, patch: Partial<AuthParams>): AuthParams {
  return {
    email: patch.email ?? base.email,
    next: patch.next ?? base.next,
    invite: patch.invite ?? base.invite,
    goal: patch.goal ?? base.goal,
  };
}
