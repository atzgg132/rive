"use client";

import { Button } from "@/components/ui";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Users,
  DollarSign,
  Receipt,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  Command,
  Loader2,
  Globe2,
  CalendarDays,
  FileSignature,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  CircleHelp,
} from "lucide-react";
import { Toaster } from "sonner";
import RiveLogo from "@/components/RiveLogo";
import Portal from "@/components/ui/Portal";
import { ThemeToggle } from "@/components/ThemeToggle";
import CommandPalette from "@/components/dashboard/CommandPalette";
import { CurrencyProvider } from "@/components/currency/CurrencyProvider";
import { CurrencySwitcher } from "@/components/currency/CurrencySwitcher";
import { FeatureAvailabilityProvider } from "@/components/FeatureAvailabilityContext";
import { ACTIVATION_GOAL_NAV_PATHS, type ActivationPlan } from "@/lib/activation";
import { GuidedExperience, openHelpFromMobileShell } from "@/components/dashboard/GuidedExperience";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  plan: string;
  avatar_url?: string;
  onboarding_status?: string;
  display_currency?: string;
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
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activation, setActivation] = useState<ActivationPlan | null>(null);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarCollapsed(window.localStorage.getItem("rive:sidebar-collapsed") === "true");
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("rive:sidebar-collapsed", String(next));
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
            if (data.user.onboarding_status && data.user.onboarding_status !== "complete" && data.user.onboarding_status !== "skipped") {
              router.replace("/onboarding");
              return;
            }
            setUser(data.user);
            setAgreementsEnabled(data.featureAvailability?.agreements === true);
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
  }, [router]);

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
  const progressiveReveal = Boolean(activation && !activation.guidanceDismissed && activation.automaticGuidanceStatus !== "completed" && activation.activationStage !== "activated");
  const goalPaths = activation ? ACTIVATION_GOAL_NAV_PATHS[activation.goal] : [];
  const overviewLink = allNavLinks[0];
  const prioritizedLinks = allNavLinks.filter((link) => goalPaths.includes(link.href));
  const navLinks = progressiveReveal ? [overviewLink, ...prioritizedLinks] : allNavLinks;
  const moreNavLinks = progressiveReveal ? allNavLinks.filter((link) => !navLinks.includes(link)) : [];
  const moreToolsActive = moreNavLinks.some((link) => pathname === link.href || pathname.startsWith(link.href + "/"));
  const moreToolsExpanded = moreToolsOpen || moreToolsActive;

  const renderNavLink = (link: (typeof allNavLinks)[number], mobile = false) => {
    const Icon = link.icon;
    const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
    return (
      <Link
        key={link.href}
        href={link.href}
        title={!mobile && sidebarCollapsed ? link.label : undefined}
        onClick={mobile ? () => setMobileMenuOpen(false) : undefined}
        className={mobile
          ? `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive ? "bg-accent text-primary dark:bg-blue-900/20 dark:text-blue-400" : "text-muted-foreground hover:bg-background hover:text-foreground dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"}`
          : `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${isActive ? "bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/10" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
        {(!sidebarCollapsed || mobile) && <span>{link.label}</span>}
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading your workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <FeatureAvailabilityProvider value={{ agreements: agreementsEnabled }}>
    <CurrencyProvider initialCurrency={user?.display_currency}>
    <div className="flex h-screen min-h-0 overflow-hidden bg-background">
      <Toaster position="bottom-right" theme="system" />
      {/* ── Desktop Sidebar ── */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col justify-between border-r border-border bg-card py-5 md:flex transition-[width,padding] duration-200 ${sidebarCollapsed ? "w-20 px-3" : "w-64 px-4"}`}>
        <div className="flex flex-col gap-7">
          <div className={`flex items-center ${sidebarCollapsed ? "flex-col gap-3" : "justify-between px-3"}`}>
            <Link href="/dashboard" className="flex items-center gap-2" title="rive. overview">
              <RiveLogo height={26} />
            </Link>
            {!sidebarCollapsed && <span className="rounded-full border border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[11px] font-semibold capitalize text-primary">
              {user?.plan}
            </span>}
            <Button variant="ghost" size="icon-sm" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} className={`text-muted-foreground hover:bg-accent hover:text-foreground ${sidebarCollapsed ? "" : "absolute left-[232px] top-[72px] border border-border bg-card shadow-sm"}`}>
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => renderNavLink(link))}
            {moreNavLinks.length > 0 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMoreToolsOpen((value) => !value)}
                  aria-expanded={moreToolsExpanded}
                  title={sidebarCollapsed ? "More tools" : undefined}
                  className={`min-h-11 justify-between rounded-xl px-3 py-2.5 text-sm font-medium ${moreToolsActive ? "bg-primary/[0.08] text-primary" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
                >
                  <span className="flex items-center gap-3"><span className="grid h-5 w-5 place-items-center text-base leading-none">…</span>{!sidebarCollapsed && <span>More tools</span>}</span>
                  {!sidebarCollapsed && <ChevronDown className={`h-4 w-4 transition-transform ${moreToolsExpanded ? "rotate-180" : ""}`} />}
                </Button>
                {moreToolsExpanded && moreNavLinks.map((link) => renderNavLink(link))}
              </>
            )}
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className={`flex items-center gap-3 px-3 py-2 ${sidebarCollapsed ? "justify-center" : ""}`} title={sidebarCollapsed ? `${user?.name} · ${user?.email}` : undefined}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/15 bg-primary/10 font-bold uppercase text-primary">
              {user?.name?.substring(0, 2) || "U"}
            </div>
            {!sidebarCollapsed && <div className="flex flex-col min-w-0">
              <span className="truncate text-sm font-semibold text-foreground">{user?.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
            </div>}
          </div>

          <Button
            variant="ghost"
            size="default"
            onClick={handleLogout}
            title={sidebarCollapsed ? "Sign out" : undefined}
            className={`w-full justify-start px-3 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300 ${sidebarCollapsed ? "justify-center" : ""}`}
          >
            <LogOut className="h-5 w-5" />
            {!sidebarCollapsed && <span>Sign out</span>}
          </Button>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <RiveLogo height={24} />
          </Link>
          <div className="flex items-center gap-1">
            <CurrencySwitcher compact />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={openHelpFromMobileShell} aria-label="Open Help & guides" className="text-muted-foreground hover:bg-background dark:text-slate-400 dark:hover:bg-slate-800">
              <CircleHelp className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation" className="text-muted-foreground hover:bg-background dark:text-slate-400 dark:hover:bg-slate-800">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* ── Desktop Top Bar ── */}
        <div className="sticky top-0 z-30 hidden h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6 xl:px-8 md:flex">
          <div className="flex items-center gap-3 max-w-md w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCommandPaletteOpen(true)}
              className="w-80 justify-between text-muted-foreground hover:border-primary/30"
            >
              <span className="flex items-center gap-2 overflow-hidden">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate whitespace-nowrap">Search workspace...</span>
              </span>
              <span className="flex items-center gap-1 rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">
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
            <CurrencySwitcher />
            <ThemeToggle />
            <GuidedExperience activation={activation} pathname={pathname} onActivationChange={setActivation} />
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
                  <span className="absolute top-1 right-1 h-2 w-2 bg-blue-600 rounded-full animate-pulse"></span>
                )}
              </Button>
              {notificationsOpen && (
                <div className="absolute right-0 z-50 mt-2 w-72 animate-fade-in-up rounded-xl border border-border bg-popover p-4 shadow-overlay">
                  <h4 className="mb-3 text-xs font-semibold text-foreground">Notifications</h4>
                  <div className="flex flex-col gap-2.5">
                    {notifications.map(n => (
                      n.href ? <Link key={n.id} href={n.href} onClick={() => setNotificationsOpen(false)} className="block border-b border-border pb-2.5 text-xs leading-5 text-foreground last:border-none last:pb-0 hover:text-primary">{n.text}</Link> : <div key={n.id} className="border-b border-border pb-2.5 text-xs leading-5 text-foreground last:border-none last:pb-0">{n.text}</div>
                    ))}
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

      {/* ── Mobile Sidebar Slideover Menu ── */}
      {mobileMenuOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/40 backdrop-blur-sm">
            <div className="relative flex w-full max-w-xs animate-fade-in-up flex-col bg-card px-4 py-6 shadow-overlay">
              <div className="flex items-center justify-between mb-8">
                <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <RiveLogo height={26} />
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation"
                  className="text-muted-foreground dark:text-slate-400 hover:bg-background dark:hover:bg-slate-800"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <nav className="flex flex-col gap-1 flex-1">
                {navLinks.map((link) => renderNavLink(link, true))}
                {moreNavLinks.length > 0 && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setMoreToolsOpen((value) => !value)}
                      aria-expanded={moreToolsExpanded}
                      className={`mt-2 justify-between rounded-xl px-3 py-2.5 text-sm font-medium ${moreToolsActive ? "bg-accent text-primary" : "text-muted-foreground"}`}
                    >
                      <span>More tools</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${moreToolsExpanded ? "rotate-180" : ""}`} />
                    </Button>
                    {moreToolsExpanded && moreNavLinks.map((link) => renderNavLink(link, true))}
                  </>
                )}
              </nav>

              <div className="flex flex-col gap-4 border-t border-border dark:border-slate-800 pt-4 mt-auto">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold uppercase">
                    {user?.name?.substring(0, 2) || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground dark:text-slate-200">{user?.name}</span>
                    <span className="block truncate text-xs text-muted-foreground dark:text-slate-400">{user?.email}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="default"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full justify-start px-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sign out</span>
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ── Command Palette Wrapper ── */}
      <CommandPalette open={commandPaletteOpen} setOpen={setCommandPaletteOpen} agreementsEnabled={agreementsEnabled} />
    </div>
    </CurrencyProvider>
    </FeatureAvailabilityProvider>
  );
}
