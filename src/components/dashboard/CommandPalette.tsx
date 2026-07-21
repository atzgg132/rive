"use client";

import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Search, FileText, Users, DollarSign, Briefcase, Receipt, PlusCircle, Settings, LayoutDashboard } from "lucide-react";
import { useTheme } from "next-themes";
import { createPortal } from "react-dom";

export default function CommandPalette({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
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

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)}>
      <div 
        className="w-full max-w-xl bg-white dark:bg-[#0B1120] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-fade-in-up" 
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="flex flex-col w-full h-full" label="Global Command Menu">
          <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-800">
            <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            <Command.Input 
              className="w-full bg-transparent px-3 py-4 text-sm outline-none placeholder:text-slate-400 dark:text-white" 
              placeholder="Search features, commands, or settings..." 
              autoFocus 
            />
          </div>
          
          <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin">
            <Command.Empty className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Command.Item 
                onSelect={() => runCommand(() => router.push("/dashboard"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/30 dark:aria-selected:text-blue-400"
              >
                <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push("/workflow/projects"))}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/30 dark:aria-selected:text-blue-400"
              >
                <Briefcase className="h-4 w-4" /> Go to Projects
              </Command.Item>
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
