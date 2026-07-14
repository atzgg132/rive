"use client";

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
  User,
  ChevronRight,
  Search,
  Bell,
  Sparkles,
  Command,
  Loader2
} from "lucide-react";
import RiveLogo from "@/components/RiveLogo";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  plan: string;
  avatar_url?: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Authenticate user session
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        const data = await res.ok ? await res.json() : null;
        if (data && data.success) {
          setUser(data.user);
        } else {
          router.replace("/login");
        }
      } catch (err) {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [router]);

  // Handle logout
  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.replace("/login");
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const navLinks = [
    { href: "/dashboard", label: "overview", icon: LayoutDashboard },
    { href: "/workflow/projects", label: "projects", icon: Briefcase },
    { href: "/workflow/clients", label: "clients", icon: Users },
    { href: "/workflow/revenue", label: "revenue & invoices", icon: DollarSign },
    { href: "/workflow/expenses", label: "expenses", icon: Receipt },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1D4ED8]" />
          <span className="text-sm font-semibold text-[#4A5E78]">loading your workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F8FC]">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#E2EAF4] py-6 px-4 shrink-0 justify-between">
        <div className="flex flex-col gap-8">
          <div className="px-3 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <RiveLogo className="h-6 w-auto" />
              <span className="text-xl font-bold tracking-tight text-[#0C1E36]">rive.</span>
            </Link>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1D4ED8] border border-blue-100 uppercase">
              {user?.plan}
            </span>
          </div>

          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? "bg-[#EFF6FF] text-[#1D4ED8] shadow-[0_4px_12px_-4px_rgba(29,78,216,0.08)]" 
                      : "text-[#4A5E78] hover:text-[#0C1E36] hover:bg-[#F5F8FC]"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? "text-[#1D4ED8]" : "text-[#4A5E78]"}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-4 border-t border-[#E2EAF4] pt-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold uppercase">
              {user?.name?.substring(0, 2) || "U"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-[#0C1E36] truncate">{user?.name}</span>
              <span className="text-xs text-[#4A5E78] truncate">{user?.email}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200"
          >
            <LogOut className="h-4.5 w-4.5" />
            <span>sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex md:hidden items-center justify-between h-16 bg-white border-b border-[#E2EAF4] px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <RiveLogo className="h-5 w-auto" />
            <span className="text-lg font-bold tracking-tight text-[#0C1E36]">rive.</span>
          </Link>
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-1 rounded-lg text-[#4A5E78] hover:bg-[#F5F8FC]"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* ── Desktop Top Bar ── */}
        <div className="hidden md:flex items-center justify-between h-16 bg-white border-b border-[#E2EAF4] px-8">
          <div className="flex items-center gap-3 max-w-md w-full">
            <button 
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E2EAF4] bg-[#F5F8FC] text-xs text-[#4A5E78] hover:border-blue-200 w-64 justify-between transition-all"
            >
              <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                <span>search or execute command...</span>
              </span>
              <span className="flex items-center gap-1 font-mono bg-white px-1.5 py-0.5 rounded border text-[10px]">
                <Command className="h-2.5 w-2.5" /> K
              </span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-1.5 rounded-lg text-[#4A5E78] hover:bg-[#F5F8FC] hover:text-[#0C1E36] relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-blue-600 rounded-full"></span>
            </button>
            <div className="h-8 w-px bg-[#E2EAF4]"></div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-1 rounded bg-[#EFF6FF] text-[#1D4ED8] border border-blue-100 flex items-center gap-1 animate-pulse">
                <Sparkles className="h-3 w-3" />
                <span>rive. co-pilot active</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Main Dashboard Workspace Content ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>

      {/* ── Mobile Sidebar Slideover Menu ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/40 backdrop-blur-sm">
          <div className="relative flex flex-col w-full max-w-xs bg-white py-6 px-4 shadow-xl animate-fade-in-up">
            <div className="flex items-center justify-between mb-8">
              <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <RiveLogo className="h-6 w-auto" />
                <span className="text-xl font-bold tracking-tight text-[#0C1E36]">rive.</span>
              </Link>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg text-[#4A5E78] hover:bg-[#F5F8FC]"
              >
                <X className="h-6 w-6" />
              </button>
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
                        ? "bg-[#EFF6FF] text-[#1D4ED8]" 
                        : "text-[#4A5E78] hover:text-[#0C1E36] hover:bg-[#F5F8FC]"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex flex-col gap-4 border-t border-[#E2EAF4] pt-4 mt-auto">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase">
                  {user?.name?.substring(0, 2) || "U"}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[#0C1E36]">{user?.name}</span>
                  <span className="text-xs text-[#4A5E78]">{user?.email}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
              >
                <LogOut className="h-5 w-5" />
                <span>sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Command Palette Placeholder Modal ── */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-slate-900/40 backdrop-blur-sm" onClick={() => setCommandPaletteOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E2EAF4] overflow-hidden animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 border-b border-[#E2EAF4] h-12">
              <Search className="h-4 w-4 text-[#4A5E78]" />
              <input 
                type="text" 
                placeholder="type a command (e.g. 'new project', 'add client')..." 
                className="flex-1 bg-transparent text-sm text-[#0C1E36] outline-none placeholder-slate-400"
                autoFocus
              />
              <button 
                onClick={() => setCommandPaletteOpen(false)}
                className="text-xs text-[#4A5E78] px-1.5 py-0.5 rounded border border-[#E2EAF4] hover:bg-[#F5F8FC]"
              >
                esc
              </button>
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">navigation commands</div>
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <button 
                    key={link.href}
                    onClick={() => {
                      router.push(link.href);
                      setCommandPaletteOpen(false);
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#4A5E78] hover:bg-[#F5F8FC] hover:text-[#0C1E36] text-left transition-all"
                  >
                    <span className="flex items-center gap-2">
                      {React.createElement(link.icon, { className: "h-3.5 w-3.5" })}
                      <span>go to {link.label}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">g + {link.label.substring(0, 1)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
