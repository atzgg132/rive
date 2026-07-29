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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Toaster } from "sonner";
import RiveLogo from "@/components/RiveLogo";
import Portal from "@/components/ui/Portal";
import { ThemeToggle } from "@/components/ThemeToggle";
import CommandPalette from "@/components/dashboard/CommandPalette";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  plan: string;
  avatar_url?: string;
  onboarding_status?: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const [notifications, setNotifications] = useState([
    { id: 1, text: "Welcome to Rive. Your client operations workspace is ready.", read: false },
    { id: 2, text: "Pro Tip: Open search to move around the workspace faster.", read: false },
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mac = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
// eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMac(mac);
      setNotifications(prev =>
        prev.map(n => n.id === 2 ? { ...n, text: `Pro Tip: Press ${mac ? "⌘K" : "Ctrl+K"} to open the Command Palette.` } : n)
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

  const navLinks = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/workflow/projects", label: "Projects", icon: Briefcase },
    { href: "/workflow/clients", label: "Clients", icon: Users },
    { href: "/workflow/revenue", label: "Revenue & invoices", icon: DollarSign },
    { href: "/workflow/expenses", label: "Expenses", icon: Receipt },
    { href: "/portfolio", label: "Portfolio", icon: Globe2 },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary dark:text-blue-500" />
          <span className="text-sm font-semibold text-muted-foreground dark:text-slate-400">Loading your workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background dark:bg-slate-950">
      <Toaster position="bottom-right" theme="system" />
      {/* ── Desktop Sidebar ── */}
      <aside className={`relative hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-border dark:border-slate-800 py-6 shrink-0 justify-between transition-[width,padding] duration-200 ${sidebarCollapsed ? "w-20 px-3" : "w-64 px-4"}`}>
        <div className="flex flex-col gap-8">
          <div className={`flex items-center ${sidebarCollapsed ? "flex-col gap-3" : "justify-between px-3"}`}>
            <Link href="/dashboard" className="flex items-center gap-2" title="rive. overview">
              <RiveLogo className="h-6 w-auto text-slate-900 dark:text-white" />
            </Link>
            {!sidebarCollapsed && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 uppercase">
              {user?.plan}
            </span>}
            <Button onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} className={`grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${sidebarCollapsed ? "" : "absolute left-[232px] top-[72px] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"}`}>
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={sidebarCollapsed ? link.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-accent dark:bg-blue-900/20 text-primary dark:text-blue-400 shadow-[0_4px_12px_-4px_rgba(29,78,216,0.08)]"
                      : "text-muted-foreground dark:text-slate-400 hover:text-foreground dark:hover:text-slate-200 hover:bg-background dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-primary dark:text-blue-400" : "text-muted-foreground dark:text-slate-400"}`} />
                  {!sidebarCollapsed && <span>{link.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-4 border-t border-border dark:border-slate-800 pt-4">
          <div className={`flex items-center gap-3 px-3 py-2 ${sidebarCollapsed ? "justify-center" : ""}`} title={sidebarCollapsed ? `${user?.name} · ${user?.email}` : undefined}>
            <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold uppercase">
              {user?.name?.substring(0, 2) || "U"}
            </div>
            {!sidebarCollapsed && <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-foreground dark:text-slate-200 truncate">{user?.name}</span>
              <span className="text-xs text-muted-foreground dark:text-slate-400 truncate">{user?.email}</span>
            </div>}
          </div>

          <Button
            onClick={handleLogout}
            title={sidebarCollapsed ? "Sign out" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 ${sidebarCollapsed ? "justify-center" : ""}`}
          >
            <LogOut className="h-4.5 w-4.5" />
            {!sidebarCollapsed && <span>Sign out</span>}
          </Button>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex md:hidden items-center justify-between h-16 bg-white dark:bg-slate-900 border-b border-border dark:border-slate-800 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <RiveLogo className="h-5 w-auto text-slate-900 dark:text-white" />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation" className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-background dark:text-slate-400 dark:hover:bg-slate-800">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* ── Desktop Top Bar ── */}
        <div className="hidden md:flex items-center justify-between h-16 bg-white dark:bg-slate-900 border-b border-border dark:border-slate-800 px-8">
          <div className="flex items-center gap-3 max-w-md w-full">
            <Button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border dark:border-slate-800 bg-background dark:bg-slate-950 text-xs text-muted-foreground dark:text-slate-400 hover:border-blue-200 dark:hover:border-blue-800/50 w-72 justify-between transition-all shrink-0"
            >
              <span className="flex items-center gap-2 overflow-hidden">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate whitespace-nowrap">Search workspace...</span>
              </span>
              <span className="flex items-center gap-1 font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border dark:border-slate-700 text-[10px]">
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
            <ThemeToggle />
            <div className="relative">
              <Button
                onClick={toggleNotifications}
                className="p-1.5 rounded-lg text-muted-foreground dark:text-slate-400 hover:bg-background dark:hover:bg-slate-800 hover:text-foreground dark:hover:text-slate-200 relative"
              >
                <Bell className="h-5 w-5" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1 right-1 h-2 w-2 bg-blue-600 rounded-full animate-pulse"></span>
                )}
              </Button>
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-border dark:border-slate-800 z-50 p-4 animate-fade-in-up">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Notifications</h4>
                  <div className="flex flex-col gap-2.5">
                    {notifications.map(n => (
                      <div key={n.id} className="text-xs text-foreground dark:text-slate-300 border-b border-border dark:border-slate-800 pb-2.5 last:border-none last:pb-0">
                        {n.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="h-8 w-px bg-[#E2EAF4] dark:bg-slate-800"></div>
          </div>
        </div>

        {/* ── Main Dashboard Workspace Content ── */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 text-foreground dark:text-slate-200 sm:p-4 md:p-6 xl:p-8">
          {children}
        </main>
      </div>

      {/* ── Mobile Sidebar Slideover Menu ── */}
      {mobileMenuOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/40 backdrop-blur-sm">
            <div className="relative flex flex-col w-full max-w-xs bg-white dark:bg-slate-900 py-6 px-4 shadow-xl animate-fade-in-up">
              <div className="flex items-center justify-between mb-8">
                <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <RiveLogo className="h-6 w-auto text-slate-900 dark:text-white" />
                </Link>
                <Button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground dark:text-slate-400 hover:bg-background dark:hover:bg-slate-800"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <nav className="flex flex-col gap-1 flex-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-accent dark:bg-blue-900/20 text-primary dark:text-blue-400"
                          : "text-muted-foreground dark:text-slate-400 hover:text-foreground dark:hover:text-slate-200 hover:bg-background dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
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
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
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
      <CommandPalette open={commandPaletteOpen} setOpen={setCommandPaletteOpen} />
    </div>
  );
}
