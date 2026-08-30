"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Search, Users, DollarSign, Briefcase, Receipt, PlusCircle, Settings, LayoutDashboard, CalendarDays, FileSignature, FileText } from "lucide-react";
import { useTheme } from "next-themes";
import { createPortal } from "react-dom";

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
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={close}>
      <div
        className="w-full max-w-xl bg-white dark:bg-background rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="flex flex-col w-full h-full" label="Global Command Menu">
          <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-800">
            <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            <Command.Input
              className="w-full bg-transparent px-3 py-4 text-sm outline-none placeholder:text-slate-400 dark:text-white"
              placeholder="Search features, commands, or settings..."
              autoFocus
              value={query}
              onValueChange={setQuery}
            />
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin">
            <Command.Empty className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {isSearchingInvoices ? "Searching invoices..." : "No results found."}
            </Command.Empty>

            {query.trim() && invoiceSearchTerm === query.trim() ? (
              <Command.Group heading="Invoices" className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {invoiceResults.map((invoice) => (
                  <Command.Item
                    key={invoice.id}
                    value={`${invoice.invoice_number} ${invoice.client_name || ""} ${invoice.project_title || ""}`}
                    onSelect={() => runCommand(() => router.push(`/workflow/invoices/${invoice.id}`))}
                    className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/30 dark:aria-selected:text-blue-400"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-medium">{invoice.invoice_number}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {[invoice.client_name, invoice.project_title].filter(Boolean).join(" · ") || "No client or project"}
                      </span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            <Command.Group heading="Navigation" className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Command.Item
                onSelect={() => runCommand(() => router.push("/dashboard"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/30 dark:aria-selected:text-blue-400"
              >
                <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/calendar"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/30 dark:aria-selected:text-blue-400"
              >
                <CalendarDays className="h-4 w-4" /> Go to Calendar
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/projects"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/30 dark:aria-selected:text-blue-400"
              >
                <Briefcase className="h-4 w-4" /> Go to Projects
              </Command.Item>
              {agreementsEnabled && <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/contracts"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/30 dark:aria-selected:text-blue-400"
              >
                <FileSignature className="h-4 w-4" /> Go to Agreements
              </Command.Item>}
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/clients"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/30 dark:aria-selected:text-blue-400"
              >
                <Users className="h-4 w-4" /> Go to Clients
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/revenue"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/30 dark:aria-selected:text-blue-400"
              >
                <DollarSign className="h-4 w-4" /> Go to Revenue & Invoices
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/expenses"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/30 dark:aria-selected:text-blue-400"
              >
                <Receipt className="h-4 w-4" /> Go to Expenses
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Quick Actions" className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {engagementFlowEnabled && (
                <Command.Item
                  onSelect={() => runCommand(() => router.push("/workflow/start-engagement"))}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:aria-selected:bg-blue-900/30"
                >
                  <PlusCircle className="h-4 w-4" /> Start a client engagement
                </Command.Item>
              )}
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/invoices/new"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 aria-selected:bg-emerald-50 aria-selected:text-emerald-700 dark:aria-selected:bg-emerald-900/30 dark:aria-selected:text-emerald-400"
              >
                <PlusCircle className="h-4 w-4" /> Create New Invoice
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/projects?new=true"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 aria-selected:bg-emerald-50 aria-selected:text-emerald-700 dark:aria-selected:bg-emerald-900/30 dark:aria-selected:text-emerald-400"
              >
                <Briefcase className="h-4 w-4" /> Create New Project
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/workflow/clients?new=true"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 aria-selected:bg-emerald-50 aria-selected:text-emerald-700 dark:aria-selected:bg-emerald-900/30 dark:aria-selected:text-emerald-400"
              >
                <Users className="h-4 w-4" /> Add New Client
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Settings" className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Command.Item
                onSelect={() => runCommand(() => setTheme(theme === "dark" ? "light" : "dark"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-900/30 dark:hover:text-purple-400 aria-selected:bg-purple-50 aria-selected:text-purple-700 dark:aria-selected:bg-purple-900/30 dark:aria-selected:text-purple-400"
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
