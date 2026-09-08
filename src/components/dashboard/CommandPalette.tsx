"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Search, Users, DollarSign, Briefcase, Receipt, PlusCircle, Settings, LayoutDashboard, CalendarDays, FileSignature, FileText } from "lucide-react";
import { useTheme } from "next-themes";
import { createPortal } from "react-dom";
import { Kicker } from "@/components/ui";

export default function CommandPalette({
  open,
  setOpen,
  agreementsEnabled = false,
  engagementFlowEnabled = false,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  agreementsEnabled?: boolean;
  engagementFlowEnabled?: boolean;
}) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState("");
  const [invoiceResults, setInvoiceResults] = useState<Array<{ id: string; invoice_number: string; client_name: string | null; project_title: string | null; status: string }>>([]);
  const [isSearchingInvoices, setIsSearchingInvoices] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  useEffect(() => {
    const search = query.trim();
    if (!open || !search) return;

    const controller = new AbortController();
    // Searching should acknowledge the new term immediately instead of showing
    // results from a previous query during the debounce window.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSearchingInvoices(true);
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/workflow/invoices?search=${encodeURIComponent(search)}&pageSize=10`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !Array.isArray(data.invoices)) throw new Error("Invoice search failed");
        if (!controller.signal.aborted) {
          setInvoiceResults(data.invoices);
          setInvoiceSearchTerm(search);
        }
      } catch {
        if (!controller.signal.aborted) {
          setInvoiceResults([]);
          setInvoiceSearchTerm(search);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearchingInvoices(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setInvoiceSearchTerm("");
    setInvoiceResults([]);
  };

  const runCommand = (command: () => void) => {
    close();
    command();
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-foreground/50 backdrop-blur-sm animate-panel-in" onClick={close}>
      <div
        className="w-full max-w-xl bg-popover rounded-none shadow-overlay overflow-hidden border border-border animate-panel-in"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="flex flex-col w-full h-full" label="Global Command Menu">
          <div className="flex items-center px-4 border-b border-border">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Command.Input
              className="w-full bg-transparent px-3 py-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              placeholder="Search features, commands, or settings..."
              autoFocus
              value={query}
              onValueChange={setQuery}
            />
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {isSearchingInvoices ? "Searching invoices..." : "No results found."}
            </Command.Empty>

            {query.trim() && invoiceSearchTerm === query.trim() ? (
              <Command.Group heading={<Kicker tone="muted" dot={false}>Invoices</Kicker>} className="px-2 py-2">
                {invoiceResults.map((invoice) => (
                  <Command.Item
                    key={invoice.id}
                    value={`${invoice.invoice_number} ${invoice.client_name || ""} ${invoice.project_title || ""}`}
                    onSelect={() => runCommand(() => router.push(`/workflow/invoices/${invoice.id}`))}
                    className="relative mt-1 flex cursor-pointer items-center gap-3 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-medium font-mono tabular-nums">{invoice.invoice_number}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[invoice.client_name, invoice.project_title].filter(Boolean).join(" · ") || "No client or project"}
                      </span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            <Command.Group heading={<Kicker tone="muted" dot={false}>Navigation</Kicker>} className="px-2 py-2">
              <Command.Item
                onSelect={() => runCommand(() => router.push("/dashboard"))}
                className="relative mt-1 flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
              >
                <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/calendar"))}
                className="relative mt-1 flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
              >
                <CalendarDays className="h-4 w-4" /> Go to Calendar
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/projects"))}
                className="relative mt-1 flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
              >
                <Briefcase className="h-4 w-4" /> Go to Projects
              </Command.Item>
              {agreementsEnabled && <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/contracts"))}
                className="relative mt-1 flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
              >
                <FileSignature className="h-4 w-4" /> Go to Agreements
              </Command.Item>}
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/clients"))}
                className="relative mt-1 flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
              >
                <Users className="h-4 w-4" /> Go to Clients
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/revenue"))}
                className="relative mt-1 flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
              >
                <DollarSign className="h-4 w-4" /> Go to Revenue & Invoices
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/expenses"))}
                className="relative mt-1 flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
              >
                <Receipt className="h-4 w-4" /> Go to Expenses
              </Command.Item>
            </Command.Group>

            <Command.Group heading={<Kicker tone="muted" dot={false}>Quick Actions</Kicker>} className="px-2 py-2">
              {engagementFlowEnabled && (
                <Command.Item
                  onSelect={() => runCommand(() => router.push("/workflow/start-engagement"))}
                  className="relative flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm font-semibold text-primary hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
                >
                  <PlusCircle className="h-4 w-4" /> New client work
                </Command.Item>
              )}
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/invoices/new"))}
                className="relative mt-1 flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
              >
                <PlusCircle className="h-4 w-4" /> Create New Invoice
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/projects?new=true"))}
                className="relative mt-1 flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
              >
                <Briefcase className="h-4 w-4" /> Create New Project
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/clients?new=true"))}
                className="relative mt-1 flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
              >
                <Users className="h-4 w-4" /> Add New Client
              </Command.Item>
            </Command.Group>

            <Command.Group heading={<Kicker tone="muted" dot={false}>Settings</Kicker>} className="px-2 py-2">
              <Command.Item
                onSelect={() => runCommand(() => setTheme(theme === "dark" ? "light" : "dark"))}
                className="relative mt-1 flex cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
              >
                <Settings className="h-4 w-4" /> Toggle {theme === "dark" ? "Light" : "Dark"} Mode
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>,
    document.body
  );
}
