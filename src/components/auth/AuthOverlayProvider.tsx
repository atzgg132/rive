"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AuthEnterVeil, AuthOverlay } from "@/components/auth/AuthOverlay";
import {
  AUTH_PATHS,
  authViewFromPathname,
  authViewFromSearch,
  emptyAuthParams,
  isAppShellPath,
  isMarketingSurface,
  mergeAuthParams,
  parseAuthHref,
  readAuthParams,
  type AuthParams,
  type AuthView,
} from "@/components/auth/authIntent";

type AuthOverlayContextValue = {
  view: AuthView | null;
  open: (view: AuthView, patch?: Partial<AuthParams>, replaceParams?: boolean) => void;
  close: () => void;
  enterWorkspace: (destination: string) => void;
};

const AuthOverlayContext = createContext<AuthOverlayContextValue | null>(null);

export function useAuthOverlay() {
  const value = useContext(AuthOverlayContext);
  if (!value) throw new Error("useAuthOverlay must be used within AuthOverlayProvider");
  return value;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function stripAuthSearch(url: URL) {
  url.searchParams.delete("auth");
  url.searchParams.delete("email");
  url.searchParams.delete("next");
  url.searchParams.delete("invite");
  url.searchParams.delete("goal");
}

function applyAuthSearch(url: URL, view: AuthView, params: AuthParams, asQuery: boolean) {
  stripAuthSearch(url);
  if (asQuery) url.searchParams.set("auth", view);
  if (params.email) url.searchParams.set("email", params.email);
  if (params.next) url.searchParams.set("next", params.next);
  if (params.invite) url.searchParams.set("invite", params.invite);
  if (params.goal) url.searchParams.set("goal", params.goal);
}

export function AuthOverlayProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [view, setView] = useState<AuthView | null>(() => authViewFromPathname(pathname));
  const [params, setParams] = useState<AuthParams>(emptyAuthParams);
  const [entering, setEntering] = useState(false);
  const [veilVisible, setVeilVisible] = useState(false);
  const enteringTo = useRef<string | null>(null);

  const syncFromLocation = useCallback(() => {
    const pathView = authViewFromPathname(window.location.pathname);
    const searchView = authViewFromSearch(window.location.search);
    setView(pathView || searchView);
    setParams(readAuthParams(window.location.search));
  }, []);

  useEffect(() => {
    // Keep overlay state aligned with App Router navigations to /login, /register, and /forgot-password.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is the source of truth after Next navigations.
    syncFromLocation();
  }, [pathname, syncFromLocation]);

  useEffect(() => {
    const onPop = () => syncFromLocation();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [syncFromLocation]);

  const open = useCallback((nextView: AuthView, patch?: Partial<AuthParams>, replaceParams = false) => {
    const merged = mergeAuthParams(replaceParams ? emptyAuthParams : params, patch || {});
    setParams(merged);
    setView(nextView);
    const url = new URL(window.location.href);
    if (authViewFromPathname(url.pathname)) {
      url.pathname = AUTH_PATHS[nextView];
      applyAuthSearch(url, nextView, merged, false);
    } else if (isMarketingSurface(url.pathname)) {
      applyAuthSearch(url, nextView, merged, true);
    } else {
      url.pathname = AUTH_PATHS[nextView];
      applyAuthSearch(url, nextView, merged, false);
      router.push(`${url.pathname}${url.search}${url.hash}`);
      return;
    }
    window.history.pushState({ auth: nextView }, "", `${url.pathname}${url.search}${url.hash}`);
  }, [params, router]);

  const close = useCallback(() => {
    setView(null);
    if (authViewFromPathname(window.location.pathname)) {
      router.replace("/");
      return;
    }
    const url = new URL(window.location.href);
    stripAuthSearch(url);
    window.history.pushState({ auth: null }, "", `${url.pathname}${url.search}${url.hash}`);
  }, [router]);

  const enterWorkspace = useCallback((destination: string) => {
    enteringTo.current = destination;
    setEntering(true);
    setVeilVisible(true);
    setView(null);
    router.prefetch(destination);
    const delay = prefersReducedMotion() ? 0 : 180;
    window.setTimeout(() => {
      const go = () => router.push(destination);
      if (delay > 0 && typeof document.startViewTransition === "function") {
        document.startViewTransition(go);
      } else {
        go();
      }
    }, delay);
  }, [router]);

  useEffect(() => {
    if (!entering) return;
    const target = enteringTo.current;
    if (target && (pathname === target || pathname.startsWith(`${target}/`))) {
      const hold = prefersReducedMotion() ? 0 : 160;
      const hide = window.setTimeout(() => {
        setVeilVisible(false);
        setEntering(false);
        enteringTo.current = null;
      }, hold);
      return () => window.clearTimeout(hide);
    }
    const failsafe = window.setTimeout(() => {
      setVeilVisible(false);
      setEntering(false);
      enteringTo.current = null;
    }, 4000);
    return () => window.clearTimeout(failsafe);
  }, [entering, pathname]);

  useEffect(() => {
    if (!view) return;
    router.prefetch("/dashboard");
    router.prefetch("/onboarding");
  }, [view, router]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (isAppShellPath(window.location.pathname)) return;
      if (!isMarketingSurface(window.location.pathname)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      const parsed = parseAuthHref(anchor.getAttribute("href") || "", window.location.origin);
      if (!parsed) return;
      event.preventDefault();
      event.stopPropagation();
      open(parsed.view, parsed.params, true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [open]);

  const value = useMemo<AuthOverlayContextValue>(
    () => ({ view, open, close, enterWorkspace }),
    [view, open, close, enterWorkspace],
  );

  const startPending = view === "register" && pathname === "/register" && Boolean(params.email) && !params.invite;

  return (
    <AuthOverlayContext.Provider value={value}>
      {children}
      <AuthOverlay
        view={entering ? null : view}
        params={params}
        startPending={startPending}
        busy={entering}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
        }}
        onSuccess={enterWorkspace}
        onViewChange={(nextView, patch) => open(nextView, patch)}
      />
      <AuthEnterVeil visible={veilVisible} />
    </AuthOverlayContext.Provider>
  );
}
