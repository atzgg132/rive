"use client";

import { Button, Kicker } from "@/components/ui";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Users,
  DollarSign,
  Receipt,
  LayoutDashboard,
  Menu,
  Search,
  Bell,
  Command,
  Loader2,
  Globe2,
  CalendarDays,
  FileSignature,
  CircleHelp,
  Plus,
} from "lucide-react";
import { Toaster } from "sonner";
import RiveLogo from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import CommandPalette from "@/components/dashboard/CommandPalette";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { CurrencyProvider } from "@/components/currency/CurrencyProvider";
import { FeatureAvailabilityProvider } from "@/components/FeatureAvailabilityContext";
import { type ActivationPlan } from "@/lib/activation";
import { GuidedExperience, openHelpFromMobileShell } from "@/components/dashboard/GuidedExperience";
import FeedbackWidget from "@/components/FeedbackWidget";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  plan: string;
  avatar_url?: string;
  onboarding_status?: string;
  display_currency?: string;
  display_currency_source?: string;
}

interface WorkspaceNotification {
  id: string;
  text: string;
  href?: string | null;
  read: boolean;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [agreementsEnabled, setAgreementsEnabled] = useState(false);
  const [engagementFlowEnabled, setEngagementFlowEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activation, setActivation] = useState<ActivationPlan | null>(null);
  const [guidanceLayerActive, setGuidanceLayerActive] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mac = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
// eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMac(mac);
      setNotifications(prev =>
        prev.map(n => n.id === "tip" ? { ...n, text: `Pro Tip: Press ${mac ? "⌘K" : "Ctrl+K"} to open the Command Palette.` } : n)
      );
    }
  }, []);

  useEffect(() => {
    let persisted = false;
    try {
      persisted = window.localStorage.getItem("rive:sidebar-collapsed") === "true";
    } catch {
      // Private browsing and storage-blocking extensions should not take down
      // the workspace shell; the control still works for the current session.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarCollapsed(persisted);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("rive:sidebar-collapsed", String(next));
      } catch {
        // Persistence is best-effort when browser storage is unavailable.
      }
      return next;
    });
  };

  const toggleNotifications = () => {
    setNotificationsOpen((open) => !open);
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    void fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => undefined);
    void fetch("/api/notifications?unread=false", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.notifications)) setNotifications(data.notifications.map((notification: { id: string; message: string; href?: string | null; read_at?: string | null }) => ({ id: notification.id, text: notification.message, href: notification.href, read: Boolean(notification.read_at) })));
      })
      .catch(() => undefined);
  };

  // Authenticate user session
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const res = await fetch("/api/auth/session", {
            credentials: "same-origin",
            cache: "no-store",
          });
          const data = await res.json().catch(() => null);
          if (cancelled) return;
          if (res.ok && data?.success) {
            if (pathname !== "/migrate" && data.user.onboarding_status && data.user.onboarding_status !== "complete" && data.user.onboarding_status !== "skipped") {
              router.replace("/onboarding");
              return;
            }
            setUser(data.user);
            setAgreementsEnabled(data.featureAvailability?.agreements === true);
            setEngagementFlowEnabled(data.featureAvailability?.engagementFlow === true);
            setLoading(false);
            return;
          }
          if (res.status === 401) break;
        } catch {
          if (attempt === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 150));
            continue;
          }
        }
        break;
      }
      if (!cancelled) {
        setLoading(false);
        router.replace("/login");
      }
    }
    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetch("/api/notifications?unread=false", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data?.success || !Array.isArray(data.notifications) || data.notifications.length === 0) return;
        setNotifications(data.notifications.map((notification: { id: string; message: string; href?: string | null; read_at?: string | null }) => ({ id: notification.id, text: notification.message, href: notification.href, read: Boolean(notification.read_at) })));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [pathname, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetch("/api/activation", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data?.success && data.activation) setActivation(data.activation as ActivationPlan);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [user]);

  // Handle logout
  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.replace("/login");
      }
    } catch {
      console.error("Logout failed");
    }
  };

  const allNavLinks = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/workflow/projects", label: "Projects", icon: Briefcase },
    ...(agreementsEnabled ? [{ href: "/workflow/contracts", label: "Agreements", icon: FileSignature }] : []),
    { href: "/workflow/clients", label: "Clients", icon: Users },
    { href: "/workflow/revenue", label: "Revenue & invoices", icon: DollarSign },
    { href: "/workflow/expenses", label: "Expenses", icon: Receipt },
    { href: "/portfolio", label: "Portfolio", icon: Globe2 },
  ];
  // Workspace destinations are never hidden: guidance may recommend a next
  // action, but every module stays visible across starting paths, refreshes,
  // and completed guidance.
  const navLinks = allNavLinks;
  const feedbackContext = pathname.startsWith("/workflow/invoices") || pathname.startsWith("/workflow/revenue")
    ? { promptKey: "invoice_workflow", module: "invoices", triggerEvent: "invoice_workflow_opened", label: "Invoice feedback" }
    : pathname.startsWith("/calendar")
      ? { promptKey: "calendar_workflow", module: "calendar", triggerEvent: "calendar_opened", label: "Calendar feedback" }
      : { promptKey: "workspace_general", module: "workspace", triggerEvent: "workspace_viewed", label: "Share feedback" };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <Kicker>Loading workspace</Kicker>
        </div>
      </div>
    );
  }

  return (
    <FeatureAvailabilityProvider value={{ agreements: agreementsEnabled, engagementFlow: engagementFlowEnabled }}>
    <CurrencyProvider initialCurrency={user?.display_currency} initialSource={user?.display_currency_source}>
    <div data-dashboard-shell className="fixed inset-0 flex min-h-0 overflow-hidden overscroll-none bg-background">
      <Toaster position="bottom-right" theme="system" toastOptions={{ classNames: { toast: "rounded-none border border-border bg-popover text-foreground shadow-overlay" } }} />
      <DashboardSidebar
        user={user}
        navLinks={navLinks}
        pathname={pathname}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        engagementFlowEnabled={engagementFlowEnabled}
        onToggleCollapsed={toggleSidebar}
        onMobileOpenChange={setMobileMenuOpen}
        onNewClientWork={() => router.push("/workflow/start-engagement")}
        onLogout={handleLogout}
      />

      {/* ── Mobile Header ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <RiveLogo height={24} />
          </Link>
          <div className="flex items-center gap-1">
            {engagementFlowEnabled && (
              <Button
                size="icon"
                aria-label="New client work"
                title="New client work"
                className="hidden sm:inline-flex"
                onClick={() => router.push("/workflow/start-engagement")}
              >
                <Plus className="h-5 w-5" />
              </Button>
            )}
            <div className="max-[359px]:hidden"><ThemeToggle /></div>
            <Button variant="ghost" size="icon" onClick={() => setCommandPaletteOpen(true)} aria-label="Search workspace" aria-haspopup="dialog" aria-expanded={commandPaletteOpen} className="text-muted-foreground"><Search className="h-5 w-5" /></Button><Button variant="ghost" size="icon" onClick={openHelpFromMobileShell} aria-label="Open Help & guides" className="hidden min-[390px]:inline-flex text-muted-foreground">
              <CircleHelp className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation" className="text-muted-foreground">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* ── Desktop Top Bar ── */}
        <div className="sticky top-0 z-30 hidden h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6 xl:px-8 md:flex">
          <div className="flex items-center gap-3 max-w-md w-full">
            <Button
              ref={searchTriggerRef}
              variant="outline"
              size="sm"
              onClick={() => setCommandPaletteOpen(true)}
              aria-haspopup="dialog"
              aria-controls="command-palette"
              aria-expanded={commandPaletteOpen}
              className={`w-80 justify-between text-muted-foreground hover:border-border hover:bg-card hover:text-foreground hover:translate-y-0 ${commandPaletteOpen ? "border-primary/50 text-primary" : ""}`}
            >
              <span className="flex items-center gap-2 overflow-hidden">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate whitespace-nowrap">Search workspace...</span>
              </span>
              <span className="flex items-center gap-1 rounded-none border border-border bg-muted px-1.5 py-0.5 font-mono text-[.7rem]">
                {isMac ? (
                  <>
                    <Command className="h-2.5 w-2.5" /> K
                  </>
                ) : (
                  "Ctrl+K"
                )}
              </span>
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {engagementFlowEnabled && (
              <Button variant="inverse" className="gap-2 whitespace-nowrap" onClick={() => router.push("/workflow/start-engagement")}>
                <Plus className="h-4 w-4" />
                New client work
              </Button>
            )}
            <ThemeToggle />
            <GuidedExperience activation={activation} pathname={pathname} onActivationChange={setActivation} onLayerVisibilityChange={setGuidanceLayerActive} />
            <div className="relative">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleNotifications}
                aria-label="Open notifications"
                className="relative text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Bell className="h-5 w-5" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute right-1 top-1 h-2 w-2 animate-pulse rounded-full bg-primary"></span>
                )}
              </Button>
              {notificationsOpen && (
                <div className="absolute right-0 z-50 mt-2 w-72 animate-panel-in rounded-none border border-border bg-popover p-4 shadow-overlay">
                  <h4 className="mb-3 text-xs font-semibold text-foreground">Notifications</h4>
                  <div className="max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto overscroll-contain pr-1">
                    <div className="flex flex-col gap-2.5">
                      {notifications.map(n => (
                        n.href ? <Link key={n.id} href={n.href} onClick={() => setNotificationsOpen(false)} className="block border-b border-border pb-2.5 text-xs leading-5 text-foreground last:border-none last:pb-0 hover:text-primary">{n.text}</Link> : <div key={n.id} className="border-b border-border pb-2.5 text-xs leading-5 text-foreground last:border-none last:pb-0">{n.text}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="h-7 w-px bg-border"></div>
          </div>
        </div>

        {/* ── Main Dashboard Workspace Content ── */}
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-background p-3 text-foreground sm:p-4 md:p-6 xl:p-8">
          {children}
        </main>
      </div>

      {/* ── Command Palette Wrapper ── */}
      <CommandPalette
        open={commandPaletteOpen}
        setOpen={setCommandPaletteOpen}
        agreementsEnabled={agreementsEnabled}
        engagementFlowEnabled={engagementFlowEnabled}
        returnFocusRef={searchTriggerRef}
      />
      {user && !guidanceLayerActive ? <div className="fixed bottom-4 right-4 z-40" data-testid="feedback-launcher"><FeedbackWidget {...feedbackContext} /></div> : null}
    </div>
    </CurrencyProvider>
    </FeatureAvailabilityProvider>
  );
}
