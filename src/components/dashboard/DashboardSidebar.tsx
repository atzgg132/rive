"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from "lucide-react";
import { Avatar, Badge, Button } from "@/components/ui";
import Portal from "@/components/ui/Portal";
import RiveLogo from "@/components/RiveLogo";
import { cn } from "@/lib/utils";

export interface DashboardNavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface DashboardSidebarUser {
  name?: string | null;
  email?: string | null;
  plan?: string | null;
}

interface DashboardSidebarProps {
  user: DashboardSidebarUser | null;
  navLinks: DashboardNavLink[];
  pathname: string;
  collapsed: boolean;
  mobileOpen: boolean;
  engagementFlowEnabled: boolean;
  onToggleCollapsed: () => void;
  onMobileOpenChange: (open: boolean) => void;
  onNewClientWork: () => void;
  onLogout: () => void | Promise<void>;
}

function initials(name: string | null | undefined): string {
  return name?.trim().substring(0, 2) || "U";
}

function identityLabel(user: DashboardSidebarUser | null): string {
  return [user?.name, user?.email].filter(Boolean).join(" · ") || "Workspace account";
}

function navLinkClassName(isActive: boolean): string {
  return cn(
    "relative flex min-h-11 min-w-0 items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
    isActive
      ? "bg-accent text-primary before:absolute before:bottom-[30%] before:left-0 before:top-[30%] before:w-[2px] before:bg-primary"
      : "text-muted-foreground hover:bg-foreground/[.05] hover:text-foreground",
  );
}

function IdentityBlock({
  user,
  collapsed = false,
  collapsedOpen = false,
  collapsedButtonRef,
  onCollapsedToggle,
}: {
  user: DashboardSidebarUser | null;
  collapsed?: boolean;
  collapsedOpen?: boolean;
  collapsedButtonRef?: RefObject<HTMLButtonElement | null>;
  onCollapsedToggle?: () => void;
}) {
  const label = identityLabel(user);
  const plan = user?.plan?.trim();

  if (collapsed) {
    return (
      <Button
        ref={collapsedButtonRef}
        type="button"
        variant="ghost"
        size="icon"
        className="mx-auto flex h-10 w-10 rounded-full p-0 hover:bg-accent hover:text-accent-foreground"
        title={plan ? `${label} · ${plan}` : label}
        aria-label={plan ? `${label} · ${plan}` : label}
        aria-haspopup="dialog"
        aria-expanded={collapsedOpen}
        aria-controls={collapsedOpen ? "sidebar-identity-popover" : undefined}
        onClick={onCollapsedToggle}
        data-sidebar-identity
      >
        <Avatar size="md" className="pointer-events-none" aria-hidden="true">
          <span>{initials(user?.name)}</span>
        </Avatar>
      </Button>
    );
  }

  return (
    <div className="min-w-0 px-3 py-2" data-sidebar-identity>
      <div className="flex min-w-0 items-center gap-3" title={label}>
        <Avatar size="md" aria-hidden="true">
          <span>{initials(user?.name)}</span>
        </Avatar>
        <div className="min-w-0 flex-1">
          <span className="block truncate whitespace-nowrap text-sm font-semibold text-foreground" title={user?.name || "Workspace account"}>
            {user?.name || "Workspace account"}
          </span>
          <span className="block truncate whitespace-nowrap text-xs text-muted-foreground" title={user?.email || undefined}>
            {user?.email || ""}
          </span>
        </div>
      </div>
      {plan ? (
        <Badge variant="outline" className="ml-12 mt-2 max-w-[calc(100%-3rem)] truncate capitalize" title={plan}>
          {plan}
        </Badge>
      ) : null}
    </div>
  );
}

function NavItems({
  navLinks,
  pathname,
  collapsed = false,
  mobile = false,
  onNavigate,
}: {
  navLinks: DashboardNavLink[];
  pathname: string;
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label={mobile ? "Mobile workspace navigation" : "Workspace navigation"} className="flex min-w-0 flex-col gap-1">
      {navLinks.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-label={collapsed && !mobile ? link.label : undefined}
            title={link.label}
            onClick={onNavigate}
            className={cn(navLinkClassName(isActive), collapsed && !mobile && "justify-center px-0")}
          >
            <Icon strokeWidth={1.75} className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
            {(!collapsed || mobile) ? (
              <span className="min-w-0 truncate whitespace-nowrap">{link.label}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardSidebar({
  user,
  navLinks,
  pathname,
  collapsed,
  mobileOpen,
  engagementFlowEnabled,
  onToggleCollapsed,
  onMobileOpenChange,
  onNewClientWork,
  onLogout,
}: DashboardSidebarProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLElement>(null);
  const collapsedIdentityButtonRef = useRef<HTMLButtonElement>(null);
  const identityPopoverRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [identityPopoverOpen, setIdentityPopoverOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusCloseButton = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onMobileOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(focusCloseButton);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, [mobileOpen, onMobileOpenChange]);

  useEffect(() => {
    if (!collapsed || !identityPopoverOpen) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!identityPopoverRef.current?.contains(target) && !collapsedIdentityButtonRef.current?.contains(target)) {
        setIdentityPopoverOpen(false);
      }
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIdentityPopoverOpen(false);
      window.requestAnimationFrame(() => collapsedIdentityButtonRef.current?.focus());
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);
    const focusPopover = window.requestAnimationFrame(() => identityPopoverRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusPopover);
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [collapsed, identityPopoverOpen]);

  useEffect(() => {
    if (collapsed) return;
    // A desktop expansion should never leave a hidden identity popover queued
    // for the next time the rail is collapsed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdentityPopoverOpen(false);
  }, [collapsed]);

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const panel = mobilePanelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onMobileOpenChange(false);
  };

  return (
    <>
      <aside
        id="dashboard-desktop-sidebar"
        aria-label="Workspace navigation"
        data-sidebar-collapsed={collapsed}
        className={cn(
          "sticky top-0 hidden h-full shrink-0 overflow-visible border-r border-border bg-card transition-[width] duration-200 md:flex",
          collapsed ? "w-[72px]" : "w-[256px]",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className={cn("flex shrink-0 items-center border-b border-border", collapsed ? "min-h-20 flex-col justify-center gap-3 px-0" : "h-16 gap-3 px-4")}>
            <Link href="/dashboard" className="flex min-w-0 shrink-0 items-center gap-2" aria-label="rive. overview" title="rive. overview">
              <RiveLogo height={26} />
            </Link>
            {!collapsed ? <div className="min-w-0 flex-1" /> : null}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              aria-controls="dashboard-sidebar-navigation"
              aria-pressed={collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              data-sidebar-toggle
              className="h-11 w-11 shrink-0 text-muted-foreground"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </div>

          <div id="dashboard-sidebar-navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
            <NavItems navLinks={navLinks} pathname={pathname} collapsed={collapsed} />
          </div>

          <div className="relative shrink-0 border-t border-border px-1 py-4">
            <div className="relative">
              <IdentityBlock
                user={user}
                collapsed={collapsed}
                collapsedOpen={identityPopoverOpen}
                collapsedButtonRef={collapsedIdentityButtonRef}
                onCollapsedToggle={() => setIdentityPopoverOpen((open) => !open)}
              />
              {collapsed && identityPopoverOpen ? (
                <div
                  ref={identityPopoverRef}
                  id="sidebar-identity-popover"
                  role="dialog"
                  aria-label="Workspace account"
                  aria-modal="false"
                  tabIndex={-1}
                  className="absolute bottom-0 left-[calc(100%+0.5rem)] z-50 w-60 border border-border bg-popover p-3 text-left shadow-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <p className="break-words whitespace-normal text-sm font-semibold text-foreground" title={user?.name || undefined}>{user?.name || "Workspace account"}</p>
                  <p className="mt-0.5 break-words whitespace-normal text-xs text-muted-foreground" title={user?.email || undefined}>{user?.email || ""}</p>
                  {user?.plan ? <Badge variant="outline" className="mt-2 capitalize">{user.plan}</Badge> : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIdentityPopoverOpen(false);
                      void onLogout();
                    }}
                    className="mt-3 w-full justify-start px-0 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </Button>
                </div>
              ) : null}
            </div>
            {!collapsed ? (
              <Button
                type="button"
                variant="ghost"
                size="default"
                onClick={() => void onLogout()}
                aria-label="Sign out"
                className="w-full justify-start px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
                <span>Sign out</span>
              </Button>
            ) : null}
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex bg-foreground/50 backdrop-blur-sm md:hidden"
            onClick={handleBackdropClick}
            role="presentation"
          >
            <aside
              ref={mobilePanelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-sidebar-title"
              onKeyDown={handlePanelKeyDown}
              className="relative flex h-full w-[min(20rem,calc(100vw-1rem))] max-w-full flex-col overflow-y-auto bg-card px-4 py-6 shadow-overlay animate-panel-in"
            >
              <div className="mb-8 flex items-center justify-between gap-3">
                <Link href="/dashboard" className="flex min-w-0 items-center gap-2" onClick={() => onMobileOpenChange(false)}>
                  <RiveLogo height={26} />
                  <span id="mobile-sidebar-title" className="sr-only">Workspace navigation</span>
                </Link>
                <Button
                  ref={closeButtonRef}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onMobileOpenChange(false)}
                  aria-label="Close navigation"
                  className="shrink-0 text-muted-foreground"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>

              <nav className="flex min-h-0 flex-1 flex-col">
                {engagementFlowEnabled ? (
                  <Button
                    type="button"
                    variant="inverse"
                    className="mb-3 w-full justify-start gap-2"
                    onClick={() => {
                      onMobileOpenChange(false);
                      onNewClientWork();
                    }}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New client work
                  </Button>
                ) : null}
                <NavItems navLinks={navLinks} pathname={pathname} mobile onNavigate={() => onMobileOpenChange(false)} />
              </nav>

              <div className="mt-6 flex shrink-0 flex-col gap-2 border-t border-border pt-4">
                <IdentityBlock user={user} />
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  onClick={() => {
                    onMobileOpenChange(false);
                    void onLogout();
                  }}
                  aria-label="Sign out"
                  className="w-full justify-start px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                  <span>Sign out</span>
                </Button>
              </div>
            </aside>
          </div>
        </Portal>
      ) : null}
    </>
  );
}
