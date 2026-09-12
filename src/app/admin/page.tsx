"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import RiveLogo from "@/components/RiveLogo";
import { AdminNav, AdminTabStrip } from "./nav";
import { Login } from "./login";
import { Overview } from "./overview-tab";
import { FunnelTab } from "./funnel-tab";
import { UsersTab } from "./users-tab";
import { FeedbackTab } from "./feedback-tab";
import { Reliability } from "./reliability-tab";
import { MigrationReliability } from "./migration-tab";
import { LegacyTab } from "./legacy-tab";
import { fetchAdmin, LoadError, Loading, tabs, useCanonicalHost, type Funnel, type Tab } from "./shared";

function Dashboard({ onLogout, onSessionExpired }: { onLogout: () => void; onSessionExpired: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") || "overview";
  const tab: Tab = tabs.some((item) => item.id === rawTab) ? rawTab as Tab : "overview";
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tab selection lives in the URL so refresh restores it and sections can be
  // deep-linked — e.g. /admin?tab=users&stage=deeply_activated from Overview.
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "overview") params.delete("tab"); else params.set("tab", next);
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchAdmin("/api/admin/analytics", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      // A 401 here means the session itself died, so hand the user back to the
      // login form with a reason instead of revoking again and re-rendering the
      // dashboard, which is what turned one expiry into a redirect loop.
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      if (!response.ok || !data?.success) throw new Error(data?.message || "Funnel metrics could not be loaded.");
      if (!data.data?.productFunnel) throw new Error("The data snapshot is incomplete. Check the Reliability tab after retrying.");
      setFunnel(data.data.productFunnel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Funnel metrics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const content = tab === "overview"
    ? <Overview funnel={funnel} refresh={load} loading={loading} error={error} />
    : tab === "funnel"
      ? <FunnelTab funnel={funnel} retry={load} loading={loading} error={error} />
      : tab === "users"
        ? <UsersTab />
        : tab === "feedback"
          ? <FeedbackTab />
          : tab === "reliability"
            ? <Reliability funnel={funnel} retry={load} loading={loading} error={error} />
            : tab === "migration"
              ? <MigrationReliability funnel={funnel} retry={load} loading={loading} error={error} />
              : <LegacyTab />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="flex items-center gap-5"><RiveLogo height={28} /><span className="hidden h-5 w-px bg-border sm:block" /><span className="hidden text-sm font-semibold text-muted-foreground sm:block">Admin workspace</span></div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success sm:block">Open beta</span>
            <ThemeToggle />
            <Button type="button" variant="ghost" size="sm" onClick={onLogout} className="gap-2"><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-8 lg:flex-row">
        <aside className="lg:sticky lg:top-20 lg:w-52 lg:shrink-0 lg:self-start">
          <div className="lg:hidden"><AdminTabStrip value={tab} onChange={setTab} /></div>
          <AdminNav className="hidden lg:flex" value={tab} onChange={setTab} />
        </aside>
        <main className="min-w-0 flex-1">{content}</main>
      </div>
    </div>
  );
}

function AdminGate() {
  useCanonicalHost();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [totpRequired, setTotpRequired] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [notice, setNotice] = useState("");

  const checkSession = useCallback(async () => {
    setSessionError("");
    try {
      const response = await fetchAdmin("/api/admin/session", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        setTotpRequired(Boolean(data?.totpRequired));
        setAuthenticated(false);
        return;
      }
      if (!response.ok) throw new Error("The admin session could not be checked.");
      setAuthenticated(true);
    } catch (err) {
      setAuthenticated(null);
      setSessionError(err instanceof Error ? err.message : "The admin session could not be checked.");
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void checkSession(), 0); return () => window.clearTimeout(timer); }, [checkSession]);

  const handleLogout = useCallback(async () => {
    await fetchAdmin("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    setNotice("You have been signed out.");
    setAuthenticated(false);
  }, []);

  // Expiry is not a sign-out: the cookie is already dead, so re-POSTing logout
  // only adds a failing request between the user and the login form.
  const handleSessionExpired = useCallback(() => {
    setNotice("Your admin session expired. Sign in again to continue.");
    setAuthenticated(false);
  }, []);

  if (sessionError) return <main className="grid min-h-screen place-items-center bg-background px-5"><div className="w-full max-w-md"><RiveLogo height={38} /><div className="mt-6"><LoadError message={sessionError} onRetry={() => void checkSession()} /></div></div></main>;
  if (authenticated === null) return <Loading label="Checking admin session" />;
  return authenticated
    ? <Dashboard onLogout={handleLogout} onSessionExpired={handleSessionExpired} />
    : <Login notice={notice} totpRequired={totpRequired} onLogin={() => { setNotice(""); setAuthenticated(true); }} />;
}

export default function AdminPage() {
  return (
    <Suspense fallback={<Loading label="Loading admin workspace" />}>
      <AdminGate />
    </Suspense>
  );
}
