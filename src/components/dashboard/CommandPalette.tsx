"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  DollarSign,
  FileSignature,
  FileText,
  LayoutDashboard,
  PlusCircle,
  Receipt,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { createPortal } from "react-dom";
import { Button, Kicker } from "@/components/ui";
import { cn } from "@/lib/utils";

type SearchGroupKey = "clients" | "projects" | "invoices" | "agreements" | "expenses";

interface SearchResult {
  id: string;
  type: SearchGroupKey;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
}

type SearchGroups = Record<SearchGroupKey, SearchResult[]>;

interface NormalizedSearch {
  recognized: boolean;
  groups: SearchGroups;
}

interface SearchRecord {
  [key: string]: unknown;
}

const SEARCH_GROUPS: Array<{ key: SearchGroupKey; label: string; icon: LucideIcon }> = [
  { key: "clients", label: "Clients", icon: Users },
  { key: "projects", label: "Projects", icon: Briefcase },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "agreements", label: "Agreements", icon: FileSignature },
  { key: "expenses", label: "Expenses", icon: Receipt },
];

const ENTITY_ALIASES: Record<string, SearchGroupKey> = {
  client: "clients",
  clients: "clients",
  project: "projects",
  projects: "projects",
  invoice: "invoices",
  invoices: "invoices",
  agreement: "agreements",
  agreements: "agreements",
  contract: "agreements",
  contracts: "agreements",
  expense: "expenses",
  expenses: "expenses",
};

function emptyGroups(): SearchGroups {
  return {
    clients: [],
    projects: [],
    invoices: [],
    agreements: [],
    expenses: [],
  };
}

function asRecord(value: unknown): SearchRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as SearchRecord : null;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function firstText(record: SearchRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = asText(record[key]);
    if (value) return value;
  }
  return "";
}

function nestedText(record: SearchRecord, parent: string, ...keys: string[]): string {
  const nested = asRecord(record[parent]);
  return nested ? firstText(nested, ...keys) : "";
}

function groupKey(value: unknown): SearchGroupKey | null {
  const normalized = asText(value).toLowerCase().replace(/[\s_-]+/g, "");
  return ENTITY_ALIASES[normalized] || null;
}

function defaultHref(type: SearchGroupKey, id: string): string {
  const encodedId = encodeURIComponent(id);
  if (type === "clients") return `/workflow/clients/${encodedId}`;
  if (type === "projects") return `/workflow/projects/${encodedId}`;
  if (type === "invoices") return `/workflow/invoices/${encodedId}`;
  if (type === "agreements") return `/workflow/contracts/${encodedId}`;
  return "/workflow/expenses";
}

function safeInternalHref(value: string, fallback: string): string {
  // Search results should stay inside the authenticated workspace. Legacy
  // response shapes may contain a generic `url` field, so never allow one to
  // turn the command palette into an arbitrary navigation sink.
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function normalizeResult(item: unknown, type: SearchGroupKey, index: number): SearchResult | null {
  if (typeof item === "string" || typeof item === "number") {
    const title = asText(item);
    if (!title) return null;
    const id = `${type}-${index}-${title}`;
    return { id, type, title, href: defaultHref(type, id) };
  }

  const record = asRecord(item);
  if (!record) return null;

  const id = firstText(record, "id", "uuid", "value") || `${type}-${index}`;
  const explicitHref = firstText(record, "href", "path", "url");
  let title = "";
  let subtitle = "";
  let meta = "";

  if (type === "clients") {
    title = firstText(record, "name", "title", "client_name", "clientName") || id;
    subtitle = firstText(record, "company", "email") || nestedText(record, "client", "company", "email");
    meta = firstText(record, "status", "project_count", "projectCount");
  } else if (type === "projects") {
    title = firstText(record, "title", "name", "project_title", "projectTitle") || id;
    subtitle = firstText(record, "client_name", "clientName", "company") || nestedText(record, "client", "name", "company");
    meta = firstText(record, "status", "deadline", "due_date", "dueDate");
  } else if (type === "invoices") {
    title = firstText(record, "invoice_number", "invoiceNumber", "number", "title", "name") || id;
    subtitle = [
      firstText(record, "client_name", "clientName") || nestedText(record, "client", "name"),
      firstText(record, "project_title", "projectTitle") || nestedText(record, "project", "title", "name"),
    ].filter(Boolean).join(" · ");
    meta = firstText(record, "status", "currency");
  } else if (type === "agreements") {
    title = firstText(record, "title", "name", "contract_title", "contractTitle") || id;
    subtitle = [
      firstText(record, "client_name", "clientName") || nestedText(record, "client", "name"),
      firstText(record, "project_title", "projectTitle") || nestedText(record, "project", "title", "name"),
    ].filter(Boolean).join(" · ");
    meta = firstText(record, "status", "provider");
  } else {
    title = firstText(record, "description", "title", "name", "expense_name", "expenseName") || id;
    subtitle = [
      firstText(record, "client_name", "clientName") || nestedText(record, "client", "name"),
      firstText(record, "project_title", "projectTitle") || nestedText(record, "project", "title", "name"),
    ].filter(Boolean).join(" · ");
    const amount = firstText(record, "amount", "total");
    const currency = firstText(record, "currency");
    meta = [amount && currency ? `${currency} ${amount}` : amount, firstText(record, "category", "status")].filter(Boolean).join(" · ");
  }

  return {
    id: `${type}:${id}`,
    type,
    title,
    subtitle: subtitle || undefined,
    meta: meta || undefined,
    href: safeInternalHref(explicitHref, defaultHref(type, id)),
  };
}

function addGroupedItems(groups: SearchGroups, key: SearchGroupKey, value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  groups[key] = value.map((item, index) => normalizeResult(item, key, index)).filter((item): item is SearchResult => Boolean(item));
  return true;
}

function normalizeSearchPayload(payload: unknown): NormalizedSearch {
  const root = asRecord(payload);
  if (!root) return { recognized: false, groups: emptyGroups() };

  const groups = emptyGroups();
  const containers: unknown[] = [root.results, root.data, root.search, root];

  for (const container of containers) {
    const record = asRecord(container);
    if (!record) continue;
    let recognized = false;
    for (const definition of SEARCH_GROUPS) {
      const singular = definition.key.slice(0, -1);
      const value = record[definition.key] ?? record[singular];
      const aliases = definition.key === "agreements" ? ["contracts"] : [];
      const groupedValue = value ?? aliases.map((alias) => record[alias]).find((candidate) => candidate !== undefined);
      if (addGroupedItems(groups, definition.key, groupedValue)) recognized = true;
    }
    if (recognized) return { recognized: true, groups };
  }

  const flatCandidates = [root.results, root.data, root.items, root.matches];
  for (const candidate of flatCandidates) {
    if (!Array.isArray(candidate)) continue;
    let recognized = false;
    for (const [index, item] of candidate.entries()) {
      const record = asRecord(item);
      const type = groupKey(record?.type ?? record?.entityType ?? record?.entity_type ?? record?.kind);
      if (!type) continue;
      const normalized = normalizeResult(item, type, index);
      if (normalized) groups[type].push(normalized);
      recognized = true;
    }
    if (recognized || candidate.length === 0) return { recognized: true, groups };
  }

  return { recognized: false, groups };
}

function normalizeInvoiceFallback(payload: unknown): NormalizedSearch {
  const root = asRecord(payload);
  if (!root || !Array.isArray(root.invoices)) return { recognized: false, groups: emptyGroups() };
  const groups = emptyGroups();
  groups.invoices = root.invoices
    .map((item, index) => normalizeResult(item, "invoices", index))
    .filter((item): item is SearchResult => Boolean(item));
  return { recognized: true, groups };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchSearchResults(query: string, signal: AbortSignal): Promise<NormalizedSearch> {
  const response = await fetch(`/api/workflow/search?q=${encodeURIComponent(query)}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (response.ok) {
    const normalized = normalizeSearchPayload(payload);
    if (normalized.recognized) return normalized;
  } else if (response.status !== 404) {
    throw new Error("Search failed");
  }

  // Keep existing invoice navigation usable while deployments roll out the
  // unified endpoint. A valid unified response never causes this fallback.
  const fallbackResponse = await fetch(`/api/workflow/invoices?search=${encodeURIComponent(query)}&pageSize=10`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const fallbackPayload = await fallbackResponse.json().catch(() => null);
  if (!fallbackResponse.ok) throw new Error("Search failed");
  return normalizeInvoiceFallback(fallbackPayload);
}

function SearchResultItem({ result, onSelect }: { result: SearchResult; onSelect: (result: SearchResult) => void }) {
  const Icon = SEARCH_GROUPS.find((group) => group.key === result.type)?.icon || Search;
  return (
    <Command.Item
      value={[result.title, result.subtitle, result.meta].filter(Boolean).join(" ")}
      onSelect={() => onSelect(result)}
      className="relative mt-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary"
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate whitespace-nowrap font-medium", result.type === "invoices" && "font-mono tabular-nums")} title={result.title}>
          {result.title}
        </span>
        {result.subtitle ? <span className="block truncate whitespace-nowrap text-xs text-muted-foreground" title={result.subtitle}>{result.subtitle}</span> : null}
      </span>
      {result.meta ? <span className="max-w-[8rem] shrink-0 truncate whitespace-nowrap text-xs text-muted-foreground" title={result.meta}>{result.meta}</span> : null}
    </Command.Item>
  );
}

const NAVIGATION_COMMANDS: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Go to Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Go to Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Go to Projects", href: "/workflow/projects", icon: Briefcase },
  { label: "Go to Clients", href: "/workflow/clients", icon: Users },
  { label: "Go to Revenue & Invoices", href: "/workflow/revenue", icon: DollarSign },
  { label: "Go to Expenses", href: "/workflow/expenses", icon: Receipt },
];

const COMMAND_ITEM_CLASS = "relative mt-1 flex min-h-11 cursor-pointer items-center gap-2 rounded-none px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:before:absolute aria-selected:before:bottom-[20%] aria-selected:before:left-0 aria-selected:before:top-[20%] aria-selected:before:w-[2px] aria-selected:before:bg-primary";

export default function CommandPalette({
  open,
  setOpen,
  agreementsEnabled = false,
  engagementFlowEnabled = false,
  returnFocusRef,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  agreementsEnabled?: boolean;
  engagementFlowEnabled?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState("");
  const [results, setResults] = useState<SearchGroups>(() => emptyGroups());
  const [searchState, setSearchState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const requestIdRef = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      setOpen(!open);
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;

    const preferredReturnFocus = returnFocusRef?.current;
    const activeElement = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
    const visibleSearchTrigger = Array.from(document.querySelectorAll<HTMLElement>('[aria-haspopup="dialog"][aria-label="Search workspace"]'))
      .find((element) => element.isConnected && element.getClientRects().length > 0) || null;
    // The shared layout ref points at the desktop trigger, which is mounted but
    // `display:none` on mobile. Prefer it only when it is actually focusable;
    // otherwise preserve the visible control that opened the palette.
    const visiblePreferredReturnFocus = preferredReturnFocus && preferredReturnFocus.isConnected && preferredReturnFocus.getClientRects().length > 0
      ? preferredReturnFocus
      : null;
    // The layout has one trigger per breakpoint. Prefer the visible trigger so
    // a click on the mobile icon is restored even when the browser leaves focus
    // on a previously focused control during the responsive swap.
    previousFocusRef.current = visiblePreferredReturnFocus || visibleSearchTrigger || activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusInput = window.requestAnimationFrame(() => inputRef.current?.focus());
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusInput);
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => previousFocusRef.current?.focus());
    };
  }, [open, returnFocusRef, setOpen]);

  useEffect(() => {
    if (open) return;
    // Reset the transient query when a parent closes the controlled palette,
    // including Escape and route changes that bypass the local close helper.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    setSettledQuery("");
    setResults(emptyGroups());
    setSearchState("idle");
  }, [open]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const requestId = ++requestIdRef.current;
    if (!open || !trimmedQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettledQuery("");
      setResults(emptyGroups());
      setSearchState("idle");
      return;
    }

    const controller = new AbortController();
    setSearchState("loading");
    setSettledQuery("");
    const timeout = window.setTimeout(() => {
      void fetchSearchResults(trimmedQuery, controller.signal)
        .then((nextResults) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setResults(nextResults.groups);
          setSettledQuery(trimmedQuery);
          setSearchState("ready");
        })
        .catch((error: unknown) => {
          if (isAbortError(error) || controller.signal.aborted || requestId !== requestIdRef.current) return;
          setResults(emptyGroups());
          setSettledQuery(trimmedQuery);
          setSearchState("error");
        });
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  const close = () => {
    requestIdRef.current += 1;
    setOpen(false);
    setQuery("");
    setSettledQuery("");
    setResults(emptyGroups());
    setSearchState("idle");
  };

  const runCommand = (command: () => void) => {
    close();
    command();
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('input, button:not([disabled]), [role="option"]'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const selectResult = (result: SearchResult) => {
    runCommand(() => router.push(result.href));
  };

  if (!mounted || !open) return null;

  const showRemoteResults = Boolean(query.trim()) && settledQuery === query.trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-foreground/50 px-3 py-[10vh] backdrop-blur-sm animate-panel-in sm:px-4 sm:py-[15vh]"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      role="presentation"
    >
      <section
        ref={dialogRef}
        id="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        aria-describedby="command-palette-description"
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-xl overflow-hidden border border-border bg-popover text-popover-foreground shadow-overlay animate-panel-in"
      >
        <h2 id="command-palette-title" className="sr-only">Global command menu</h2>
        <p id="command-palette-description" className="sr-only">Search workspace records or choose a navigation and create action.</p>
        <Command className="flex h-full w-full flex-col" label="Global Command Menu">
          <div className="flex items-center border-b border-border px-3 sm:px-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input
              ref={inputRef}
              className="w-full bg-transparent px-3 py-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              placeholder="Search features, commands, or settings..."
              aria-label="Search features, commands, or settings"
              autoFocus
              value={query}
              onValueChange={setQuery}
            />
            <Button type="button" variant="ghost" size="icon-sm" onClick={close} aria-label="Close command palette" title="Close command palette" className="shrink-0 text-muted-foreground">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <Command.List id="command-palette-list" aria-busy={searchState === "loading"} className="max-h-[min(60vh,32rem)] overflow-y-auto p-2 scrollbar-thin">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {searchState === "loading" ? "Searching workspace…" : searchState === "error" ? "Search is unavailable right now." : "No results found."}
            </Command.Empty>

            {showRemoteResults ? SEARCH_GROUPS.map(({ key, label }) => {
              const groupResults = results[key];
              if (!groupResults.length) return null;
              return (
                <Command.Group key={key} heading={<Kicker tone="muted" dot={false}>{label}</Kicker>} className="px-2 py-2">
                  {groupResults.map((result) => <SearchResultItem key={result.id} result={result} onSelect={selectResult} />)}
                </Command.Group>
              );
            }) : null}

            <Command.Group heading={<Kicker tone="muted" dot={false}>Navigation</Kicker>} className="px-2 py-2">
              {NAVIGATION_COMMANDS.map(({ label, href, icon: Icon }) => (
                <Command.Item key={href} value={label} onSelect={() => runCommand(() => router.push(href))} className={COMMAND_ITEM_CLASS}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </Command.Item>
              ))}
              {agreementsEnabled ? (
                <Command.Item value="Go to Agreements" onSelect={() => runCommand(() => router.push("/workflow/contracts"))} className={COMMAND_ITEM_CLASS}>
                  <FileSignature className="h-4 w-4" aria-hidden="true" />
                  Go to Agreements
                </Command.Item>
              ) : null}
            </Command.Group>

            <Command.Group heading={<Kicker tone="muted" dot={false}>Quick Actions</Kicker>} className="px-2 py-2">
              {engagementFlowEnabled ? (
                <Command.Item value="New client work" onSelect={() => runCommand(() => router.push("/workflow/start-engagement"))} className={cn(COMMAND_ITEM_CLASS, "font-semibold text-primary")}>
                  <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  New client work
                </Command.Item>
              ) : null}
              <Command.Item value="Create New Invoice" onSelect={() => runCommand(() => router.push("/workflow/invoices/new"))} className={COMMAND_ITEM_CLASS}>
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Create New Invoice
              </Command.Item>
              <Command.Item value="Create New Project" onSelect={() => runCommand(() => router.push("/workflow/projects?new=true"))} className={COMMAND_ITEM_CLASS}>
                <Briefcase className="h-4 w-4" aria-hidden="true" />
                Create New Project
              </Command.Item>
              <Command.Item value="Add New Client" onSelect={() => runCommand(() => router.push("/workflow/clients?new=true"))} className={COMMAND_ITEM_CLASS}>
                <Users className="h-4 w-4" aria-hidden="true" />
                Add New Client
              </Command.Item>
              {agreementsEnabled ? (
                <Command.Item value="Create New Agreement" onSelect={() => runCommand(() => router.push("/workflow/contracts?new=1"))} className={COMMAND_ITEM_CLASS}>
                  <FileSignature className="h-4 w-4" aria-hidden="true" />
                  Create New Agreement
                </Command.Item>
              ) : null}
            </Command.Group>

            <Command.Group heading={<Kicker tone="muted" dot={false}>Settings</Kicker>} className="px-2 py-2">
              <Command.Item value="Toggle dark mode" onSelect={() => runCommand(() => setTheme(theme === "dark" ? "light" : "dark"))} className={COMMAND_ITEM_CLASS}>
                <Settings className="h-4 w-4" aria-hidden="true" />
                Toggle {theme === "dark" ? "Light" : "Dark"} Mode
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </section>
    </div>,
    document.body,
  );
}
