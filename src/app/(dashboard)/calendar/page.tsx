"use client";

import { Button, Input, PageHeader, Textarea, Select } from "@/components/ui";

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Cloud,
  Clock3,
  Copy,
  ExternalLink,
  Focus,
  Info,
  Link2,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Portal from "@/components/ui/Portal";

type CalendarItem = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  isVisible: boolean;
  externalCalendars: Array<{ id: string; name: string; accessRole: string | null; selected: boolean; connection: { provider: string; status: string } }>;
};

type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  meetingUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  startDate: string | null;
  endDate: string | null;
  allDay: boolean;
  timeZone: string;
  availability: string;
  source: string;
  color: string;
  clientId: string | null;
  projectId: string | null;
  taskId: string | null;
  invoiceId: string | null;
  readOnly: boolean;
};

type Task = {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  scheduledStartAt: string | null;
  estimatedMinutes: number | null;
  project: { title: string } | null;
};

type Connection = {
  id: string;
  provider: string;
  accountEmail: string | null;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  externalCalendars: Array<{ id: string; name: string; color: string | null; selected: boolean; accessRole: string | null }>;
};

type View = "month" | "week" | "agenda";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = Array.from({ length: 12 }, (_, month) => new Date(2020, month, 1).toLocaleDateString("en", { month: "short" }));
const HOURS = Array.from({ length: 15 }, (_, index) => index + 7);
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-950";

function startOfWeek(value: Date): Date {
  const result = new Date(value);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function dateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eventDateKey(event: CalendarEvent): string {
  return event.startDate || (event.startAt ? dateKey(event.startAt) : "");
}

function rangeFor(view: View, cursor: Date) {
  if (view === "week") {
    const start = startOfWeek(cursor);
    return { start, end: addDays(start, 7) };
  }
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = addDays(start, view === "agenda" ? 62 : 42);
  return { start, end };
}

function formatTime(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function sourceLabel(source: string): string {
  if (source === "derived") return "rive. deadline";
  if (source === "task") return "scheduled task";
  if (source === "google" || source === "external_readonly") return "google calendar";
  return "rive. event";
}

function eventStartTime(event: CalendarEvent): number {
  if (event.allDay) return Number.NEGATIVE_INFINITY;
  return event.startAt ? new Date(event.startAt).getTime() : Number.POSITIVE_INFINITY;
}

function sortCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((left, right) => {
    const timeDifference = eventStartTime(left) - eventStartTime(right);
    return timeDifference || left.title.localeCompare(right.title);
  });
}

type PositionedEvent = {
  event: CalendarEvent;
  lane: number;
  laneCount: number;
};

function layoutOverlappingEvents(events: CalendarEvent[]): PositionedEvent[] {
  const sorted = sortCalendarEvents(events).filter((event) => event.startAt && event.endAt);
  const clusters: CalendarEvent[][] = [];
  let cluster: CalendarEvent[] = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;

  for (const event of sorted) {
    const start = new Date(event.startAt!).getTime();
    const end = new Date(event.endAt!).getTime();
    if (cluster.length && start >= clusterEnd) {
      clusters.push(cluster);
      cluster = [];
      clusterEnd = Number.NEGATIVE_INFINITY;
    }
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) clusters.push(cluster);

  return clusters.flatMap((overlappingEvents) => {
    const laneEnds: number[] = [];
    const positioned = overlappingEvents.map((event) => {
      const start = new Date(event.startAt!).getTime();
      const end = new Date(event.endAt!).getTime();
      const availableLane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      const lane = availableLane === -1 ? laneEnds.length : availableLane;
      laneEnds[lane] = end;
      return { event, lane };
    });
    const laneCount = Math.max(1, laneEnds.length);
    return positioned.map((item) => ({ ...item, laneCount }));
  });
}

export default function CalendarPage() {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [googleCalendarAvailable, setGoogleCalendarAvailable] = useState(false);
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [taskMode, setTaskMode] = useState<"create" | "schedule" | null>(null);
  const [taskToSchedule, setTaskToSchedule] = useState<Task | null>(null);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [guideReady, setGuideReady] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStorageKey, setGuideStorageKey] = useState("rive:calendar-guide:v1");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [draftDate, setDraftDate] = useState(() => dateKey(new Date()));
  const [draftStart, setDraftStart] = useState("09:00");
  const [draftEnd, setDraftEnd] = useState("10:00");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftAllDay, setDraftAllDay] = useState(false);
  const [draftAvailability, setDraftAvailability] = useState<"busy" | "free">("busy");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskEstimate, setTaskEstimate] = useState("60");
  const [taskScheduleDate, setTaskScheduleDate] = useState(() => dateKey(new Date()));
  const [taskScheduleStart, setTaskScheduleStart] = useState("09:00");

  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() });
      const [eventResponse, calendarResponse, taskResponse, connectionResponse] = await Promise.all([
        fetch(`/api/calendar/events?${params}`),
        fetch("/api/calendar/calendars"),
        fetch("/api/calendar/tasks"),
        fetch("/api/calendar/connections"),
      ]);
      if ([eventResponse, calendarResponse, taskResponse, connectionResponse].some((response) => !response.ok)) {
        throw new Error("Calendar workspace could not be loaded.");
      }
      const [eventData, calendarData, taskData, connectionData] = await Promise.all([
        eventResponse.json(),
        calendarResponse.json(),
        taskResponse.json(),
        connectionResponse.json(),
      ]);
      setEvents(eventData.events || []);
      setCalendars(calendarData.calendars || []);
      setTasks(taskData.tasks || []);
      setConnections(connectionData.connections || []);
      setGoogleCalendarAvailable(connectionData.connectorAvailability?.googleCalendar === true);
      setVisibleCalendars((current) => current.size ? current : new Set((calendarData.calendars || []).filter((item: CalendarItem) => item.isVisible).map((item: CalendarItem) => item.id)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Calendar could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [range.end, range.start]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "google") toast.success("Google Calendar connected and synchronized.");
    if (params.get("connectionError")) toast.error("Google Calendar could not be connected. Check the integration configuration.");
  }, []);

  useEffect(() => {
    async function loadGuidePreference() {
      const response = await fetch("/api/auth/session").catch(() => null);
      const data = response?.ok ? await response.json().catch(() => null) : null;
      const key = `rive:calendar-guide:${data?.user?.id || "local"}:v1`;
      setGuideStorageKey(key);
      setShowGuide(window.localStorage.getItem(key) !== "dismissed");
      setGuideReady(true);
    }
    void loadGuidePreference();
  }, []);

  const visibleEvents = useMemo(
    () => events.filter((event) => visibleCalendars.has(event.calendarId)),
    [events, visibleCalendars],
  );

  const groupedEvents = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of visibleEvents) {
      const key = eventDateKey(event);
      grouped.set(key, [...(grouped.get(key) || []), event]);
    }
    for (const [key, items] of grouped) grouped.set(key, sortCalendarEvents(items));
    return grouped;
  }, [visibleEvents]);

  const unscheduledTasks = tasks.filter((task) => !task.scheduledStartAt);
  const visibleConnections = googleCalendarAvailable
    ? connections
    : connections.filter((connection) => connection.provider !== "google");
  const googleConnections = visibleConnections.filter((connection) => connection.provider === "google");
  const connectedCalendars = visibleConnections.reduce(
    (total, connection) => total + connection.externalCalendars.filter((calendar) => calendar.selected).length,
    0,
  );
  const deadlineCount = visibleEvents.filter(
    (event) => event.allDay && ["derived", "task"].includes(event.source),
  ).length;
  const scheduledFocusMinutes = visibleEvents
    .filter((event) => event.source === "task" && event.startAt && event.endAt)
    .reduce(
      (total, event) => total + Math.max(0, new Date(event.endAt!).getTime() - new Date(event.startAt!).getTime()) / 60000,
      0,
    );

  function openCreate(date = new Date(), hour = 9) {
    setEditingId(null);
    setDraftDate(dateKey(date));
    setDraftStart(`${String(hour).padStart(2, "0")}:00`);
    setDraftEnd(`${String(Math.min(hour + 1, 23)).padStart(2, "0")}:00`);
    setDraftTitle("");
    setDraftDescription("");
    setDraftLocation("");
    setDraftAllDay(false);
    setDraftAvailability("busy");
    setCreateOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    if (event.readOnly || ["derived", "task"].includes(event.source)) return;
    setEditingId(event.id);
    setDraftTitle(event.title);
    setDraftDescription(event.description || "");
    setDraftLocation(event.location || "");
    setDraftAllDay(event.allDay);
    setDraftAvailability(event.availability === "free" ? "free" : "busy");
    if (event.allDay && event.startDate) {
      setDraftDate(event.startDate);
    } else if (event.startAt && event.endAt) {
      const start = new Date(event.startAt);
      const end = new Date(event.endAt);
      setDraftDate(dateKey(start));
      setDraftStart(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`);
      setDraftEnd(`${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`);
    }
    setSelectedEvent(null);
    setCreateOpen(true);
  }

  async function createEvent(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const payload = draftAllDay
        ? {
            title: draftTitle,
            description: draftDescription,
            location: draftLocation,
            allDay: true,
            startDate: draftDate,
            endDate: dateKey(addDays(new Date(`${draftDate}T12:00:00`), 1)),
            timeZone,
            availability: draftAvailability,
          }
        : {
            title: draftTitle,
            description: draftDescription,
            location: draftLocation,
            allDay: false,
            startAt: new Date(`${draftDate}T${draftStart}:00`).toISOString(),
            endAt: new Date(`${draftDate}T${draftEnd}:00`).toISOString(),
            timeZone,
            availability: draftAvailability,
          };
      const response = await fetch("/api/calendar/events", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Event could not be created.");
      toast.success(data.synced ? `Event ${editingId ? "updated" : "created"} and synced.` : `Event ${editingId ? "updated" : "created"}.`);
      setCreateOpen(false);
      await loadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Event could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent() {
    if (!selectedEvent || selectedEvent.readOnly || selectedEvent.source === "derived" || selectedEvent.source === "task") return;
    const response = await fetch(`/api/calendar/events?id=${encodeURIComponent(selectedEvent.id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message || "Event could not be removed.");
    toast.success("Event removed.");
    setSelectedEvent(null);
    await loadWorkspace();
  }

  async function completeTaskById(taskId: string) {
    const response = await fetch("/api/calendar/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: "done" }),
    });
    if (!response.ok) return toast.error("Task could not be completed.");
    toast.success("Task completed.");
    setSelectedEvent(null);
    await loadWorkspace();
  }

  async function completeTask(task: Task) {
    await completeTaskById(task.id);
  }

  function openTaskComposer() {
    setTaskMode("create");
    setTaskToSchedule(null);
    setTaskTitle("");
    setTaskPriority("medium");
    setTaskDueDate("");
    setTaskEstimate("60");
  }

  function openTaskScheduler(task: Task) {
    setTaskMode("schedule");
    setTaskToSchedule(task);
    setTaskTitle(task.title);
    setTaskEstimate(String(task.estimatedMinutes || 60));
    setTaskScheduleDate(task.dueDate ? dateKey(task.dueDate) : dateKey(new Date()));
    setTaskScheduleStart("09:00");
  }

  async function saveTask(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const estimate = Math.max(15, Math.min(1440, Number(taskEstimate) || 60));
      const isScheduling = taskMode === "schedule" && taskToSchedule;
      const startAt = isScheduling ? new Date(`${taskScheduleDate}T${taskScheduleStart}:00`) : null;
      const response = await fetch("/api/calendar/tasks", {
        method: isScheduling ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isScheduling ? {
          id: taskToSchedule.id,
          scheduledStartAt: startAt!.toISOString(),
          scheduledEndAt: new Date(startAt!.getTime() + estimate * 60000).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        } : {
          title: taskTitle.trim(),
          priority: taskPriority,
          dueDate: taskDueDate || null,
          estimatedMinutes: estimate,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Task could not be saved.");
      toast.success(isScheduling ? "Focus block added to your calendar." : "Task added to your planning queue.");
      setTaskMode(null);
      setTaskToSchedule(null);
      await loadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Task could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function moveCursor(direction: number) {
    const next = new Date(cursor);
    if (view === "week") next.setDate(next.getDate() + direction * 7);
    else next.setMonth(next.getMonth() + direction);
    setCursor(next);
  }

  async function syncGoogle(connectionId: string) {
    setSyncing(true);
    try {
      const response = await fetch("/api/calendar/connections/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Synchronization failed.");
      toast.success("Google Calendar is up to date.");
      await loadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Synchronization failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function toggleExternalCalendar(externalCalendarId: string, selected: boolean) {
    const response = await fetch("/api/calendar/connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalCalendarId, selected }),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message || "Calendar selection could not be changed.");
    toast.success(selected ? "Calendar added to rive." : "Calendar hidden from rive.");
    await loadWorkspace();
  }

  async function createAppleFeed() {
    const response = await fetch("/api/calendar/subscription", { method: "POST" });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message || "Apple feed could not be created.");
    setFeedUrl(data.webcalUrl);
    toast.success("Private Apple Calendar feed created.");
  }

  async function copyFeed() {
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function revokeAppleFeed() {
    const response = await fetch("/api/calendar/subscription", { method: "DELETE" });
    if (!response.ok) return toast.error("Apple Calendar feed could not be revoked.");
    setFeedUrl("");
    toast.success("Private Apple Calendar feed revoked.");
  }

  function dismissGuide() {
    window.localStorage.setItem(guideStorageKey, "dismissed");
    setShowGuide(false);
  }

  function selectMonth(month: number) {
    setCursor(new Date(cursor.getFullYear(), month, 1));
    setView("month");
  }

  function selectYear(year: number) {
    if (!Number.isInteger(year) || year < 1970 || year > 2100) return;
    setCursor(new Date(year, cursor.getMonth(), 1));
    setView("month");
  }

  const title = view === "week"
    ? `${range.start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${addDays(range.end, -1).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
    : cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="calendar-shell workspace-page max-w-[100rem]">
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2"><CalendarDays className="h-6 w-6 text-primary" /> Every commitment, in one calendar <span className="rounded-full border border-primary/15 bg-primary/[0.07] px-2.5 py-1 text-xs font-semibold tracking-normal text-primary">Smart calendar</span></span>}
        description="Plan client work, protect focus time, and see projects, milestones, invoice dates, tasks, and meetings on one live timeline."
        actions={<>
          {guideReady && !showGuide && <Button variant="ghost" onClick={() => setShowGuide(true)} className="hidden sm:inline-flex"><Info /> How it connects</Button>}
          <Button variant="outline" onClick={() => setConnectionsOpen(true)}><span className={`h-2 w-2 rounded-full ${visibleConnections.length ? "bg-success" : "bg-warning"}`} /><Link2 /> {visibleConnections.length ? `${connectedCalendars} synced` : "Calendar feeds"}</Button>
          <Button variant="outline" onClick={openTaskComposer} className="hidden sm:inline-flex"><ListTodo /> Add task</Button>
          <Button onClick={() => openCreate()}><Plus /> New event</Button>
        </>}
      />

      {guideReady && showGuide && <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-black text-slate-800 dark:text-white">How your workspace flows into the calendar</p><p className="mt-0.5 text-[10px] text-slate-400">These are live projections from your rive. records—not copies you need to maintain twice.</p></div>
          <Button onClick={dismissGuide} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[9px] font-bold text-slate-500 hover:border-blue-200 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400"><X className="h-3 w-3" />Got it, hide this</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ValueCard icon={<Briefcase className="h-4 w-4" />} tone="blue" value={`${deadlineCount} live deadlines`} title="Projects & milestones" description="Start dates and incomplete delivery deadlines update from project records." />
          <ValueCard icon={<Timer className="h-4 w-4" />} tone="teal" value={`${Math.round(scheduledFocusMinutes / 60 * 10) / 10}h protected`} title="Tasks & focus time" description="Due tasks appear automatically; schedule and complete focus blocks here." />
          <ValueCard icon={<CircleDollarSign className="h-4 w-4" />} tone="amber" value="Money dates included" title="Revenue & invoices" description="Every unpaid invoice due date stays beside the work that earns it." />
          <ValueCard icon={<Cloud className="h-4 w-4" />} tone="violet" value={visibleConnections.length ? `${connectedCalendars} calendars active` : "Ready to connect"} title={googleCalendarAvailable ? "Google & Apple" : "Apple calendar"} description={googleCalendarAvailable ? "rive. events sync both ways with Google; Apple receives the combined feed." : "Apple can receive a private, read-only feed of rive. events and deadlines."} />
        </div>
        {!visibleConnections.length && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 dark:border-blue-900/60 dark:from-blue-950/30 dark:to-indigo-950/20">
            <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white"><Sparkles className="h-4 w-4" /></span><div><p className="text-xs font-black text-slate-800 dark:text-white">Make this your single source of truth</p><p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{googleCalendarAvailable ? "Connect Google Calendar for continuous two-way sync, or add rive. to Apple Calendar with a private feed." : "Add rive. to Apple Calendar with a private feed."}</p></div></div>
            <Button onClick={() => setConnectionsOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-blue-700">Finish setup <ArrowRight className="h-3.5 w-3.5" /></Button>
          </div>
        )}
        <p className="mt-3 text-[9px] text-slate-400">Clients provide context through their projects and invoices. Expenses and portfolio publishing do not create calendar items yet.</p>
      </section>}

      <div className="grid min-h-[calc(100vh-300px)] 2xl:grid-cols-[210px_minmax(0,1fr)_270px]">
        <aside className="hidden border-r border-border bg-white p-4 dark:border-slate-800 dark:bg-slate-900 2xl:block">
          <Button onClick={() => setCursor(new Date())} className="mb-5 w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200">Today</Button>
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">My calendars</p>
          <div className="space-y-1">
            {calendars.map((calendar) => (
              <label key={calendar.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                <Input type="checkbox" checked={visibleCalendars.has(calendar.id)} onChange={() => setVisibleCalendars((current) => {
                  const next = new Set(current);
                  if (next.has(calendar.id)) next.delete(calendar.id); else next.add(calendar.id);
                  return next;
                })} className="sr-only" />
                <span className={`grid h-4 w-4 place-items-center rounded border ${visibleCalendars.has(calendar.id) ? "border-transparent text-white" : "border-slate-300"}`} style={{ background: visibleCalendars.has(calendar.id) ? calendar.color : "transparent" }}>{visibleCalendars.has(calendar.id) && <Check className="h-3 w-3" />}</span>
                <span className="min-w-0 flex-1 truncate">{calendar.name}</span>
                {calendar.externalCalendars.length > 0 && <span className="text-[9px] uppercase text-slate-400">{calendar.externalCalendars[0].connection.provider}</span>}
              </label>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Live, not copied</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">Linked deadlines update when their original project, task, or invoice changes.</p>
          </div>
        </aside>

        <main className="min-w-0 p-3 sm:p-5 lg:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1">
              <Button onClick={() => moveCursor(-1)} aria-label="Previous date range" className="rounded-lg p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /></Button>
              <Button onClick={() => moveCursor(1)} aria-label="Next date range" className="rounded-lg p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-800"><ChevronRight className="h-4 w-4" /></Button>
              <Button onClick={() => setCursor(new Date())} className="ml-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Today</Button>
              <div className="ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <CalendarRange className="h-3.5 w-3.5 text-blue-500" />
                <Select aria-label="Select month" value={cursor.getMonth()} onChange={(event) => selectMonth(Number(event.target.value))} className="h-auto w-auto border-0 bg-transparent p-0 text-[10px] font-bold shadow-none outline-none focus-visible:ring-0 dark:bg-slate-900">{MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}</Select>
                <Input aria-label="Select year" type="number" min="1970" max="2100" value={cursor.getFullYear()} onChange={(event) => selectYear(Number(event.target.value))} className="h-auto w-12 border-0 bg-transparent p-0 text-[10px] font-bold shadow-none outline-none [appearance:textfield] focus-visible:ring-0 dark:bg-slate-900 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </div>
              <h2 className="ml-2 text-sm font-black text-slate-800 dark:text-white">{title}</h2>
            </div>
            <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              {(["month", "week", "agenda"] as View[]).map((item) => <Button key={item} onClick={() => setView(item)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${view === item ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 dark:text-slate-400"}`}>{item}</Button>)}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
            <span>Double-click any day or time to create an event.</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-500" />Tasks become focus blocks when scheduled.</span>
          </div>

          {loading ? (
            <div className="grid h-[560px] place-items-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : view === "month" ? (
            <MonthView rangeStart={range.start} groupedEvents={groupedEvents} onCreate={openCreate} onSelect={setSelectedEvent} />
          ) : view === "week" ? (
            <WeekView rangeStart={range.start} events={visibleEvents} onCreate={openCreate} onSelect={setSelectedEvent} />
          ) : (
            <AgendaView events={visibleEvents} onSelect={setSelectedEvent} />
          )}
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 2xl:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-black text-slate-800 dark:text-white">Planning queue</p><p className="mt-0.5 text-[10px] text-slate-400">Turn unfinished tasks into protected focus blocks.</p></div>
              <Button onClick={openTaskComposer} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"><Plus className="h-3.5 w-3.5" />Add task</Button>
            </div>
            {unscheduledTasks.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{unscheduledTasks.slice(0, 6).map((task) => <div key={task.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"><Button onClick={() => completeTask(task)} aria-label={`Complete ${task.title}`} className="h-4 w-4 shrink-0 rounded-full border border-slate-300 hover:border-emerald-500 dark:border-slate-600" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{task.title}</p><p className="mt-0.5 text-[9px] text-slate-400">{task.estimatedMinutes || 60} min{task.dueDate ? ` · due ${new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}</p></div><Button onClick={() => openTaskScheduler(task)} className="rounded-lg bg-teal-50 px-2 py-1.5 text-[9px] font-bold text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">Schedule</Button></div>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-200 py-4 text-center text-[10px] text-slate-400 dark:border-slate-700">Nothing waiting. Your current plan is fully scheduled.</p>}
          </section>
        </main>

        <aside className="hidden border-t border-border bg-white p-4 dark:border-slate-800 dark:bg-slate-900 2xl:block 2xl:border-l 2xl:border-t-0">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="text-xs font-black text-slate-800 dark:text-white">Planning queue</p><p className="mt-0.5 text-[10px] text-slate-400">Give every task a home</p></div>
            <ListTodo className="h-4 w-4 text-teal-500" />
          </div>
          {unscheduledTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center dark:border-slate-700"><Focus className="mx-auto h-5 w-5 text-slate-300" /><p className="mt-2 text-[10px] font-bold text-slate-500">Your plan is clear.</p><p className="mt-1 text-[9px] leading-4 text-slate-400">New tasks wait here until you reserve time for them.</p></div>
          ) : (
            <div className="space-y-2">
              {unscheduledTasks.slice(0, 8).map((task) => (
                <div key={task.id} className="group rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-start gap-2">
                    <Button onClick={() => completeTask(task)} aria-label={`Complete ${task.title}`} className="mt-0.5 h-4 w-4 rounded-full border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 dark:border-slate-600" />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{task.title}</p>{task.project && <p className="mt-0.5 truncate text-[9px] text-slate-400">{task.project.title}</p>}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-[9px] text-slate-400">{task.estimatedMinutes && <span>{task.estimatedMinutes} min</span>}{task.dueDate && <span>due {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}</div><Button onClick={() => openTaskScheduler(task)} className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-1 text-[9px] font-bold text-teal-700 hover:bg-teal-100 dark:bg-teal-950/30 dark:text-teal-300"><Clock3 className="h-3 w-3" />Schedule</Button></div>
                </div>
              ))}
            </div>
          )}
          <Button onClick={openTaskComposer} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[10px] font-bold text-slate-500 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700"><Plus className="h-3.5 w-3.5" />Add task</Button>
        </aside>
      </div>

      {taskMode && (
        <Portal><ModalShell title={taskMode === "schedule" ? "protect time for this task" : "add work to your planning queue"} onClose={() => setTaskMode(null)}>
          <form onSubmit={saveTask} className="space-y-4">
            {taskMode === "create" ? (
              <>
                <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3 dark:border-teal-900/50 dark:bg-teal-950/20"><p className="text-xs font-bold text-teal-800 dark:text-teal-200">Capture now. Schedule when you are ready.</p><p className="mt-1 text-[10px] leading-4 text-teal-700/70 dark:text-teal-300/70">The task enters your planning queue, where you can turn it into a focused block on the calendar.</p></div>
                <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">What needs to get done?</span><Input autoFocus required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Prepare client proposal" className={inputClass} /></label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label><span className="mb-1.5 block text-[10px] font-bold text-slate-500">Priority</span><Select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)} className={inputClass}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></Select></label>
                  <label><span className="mb-1.5 block text-[10px] font-bold text-slate-500">Due date</span><Input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} className={inputClass} /></label>
                  <label><span className="mb-1.5 block text-[10px] font-bold text-slate-500">Estimate</span><Select value={taskEstimate} onChange={(event) => setTaskEstimate(event.target.value)} className={inputClass}><option value="30">30 Min</option><option value="60">1 Hour</option><option value="90">1.5 Hours</option><option value="120">2 Hours</option><option value="240">Half day</option></Select></label>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20"><p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-300">Focus block</p><p className="mt-1 text-sm font-black text-slate-800 dark:text-white">{taskToSchedule?.title}</p><p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">rive. will reserve this time as busy and keep the block linked to the original task.</p></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label><span className="mb-1.5 block text-[10px] font-bold text-slate-500">Date</span><Input type="date" required value={taskScheduleDate} onChange={(event) => setTaskScheduleDate(event.target.value)} className={inputClass} /></label>
                  <label><span className="mb-1.5 block text-[10px] font-bold text-slate-500">Starts</span><Input type="time" required value={taskScheduleStart} onChange={(event) => setTaskScheduleStart(event.target.value)} className={inputClass} /></label>
                  <label><span className="mb-1.5 block text-[10px] font-bold text-slate-500">Duration</span><Select value={taskEstimate} onChange={(event) => setTaskEstimate(event.target.value)} className={inputClass}><option value="30">30 Min</option><option value="60">1 Hour</option><option value="90">1.5 Hours</option><option value="120">2 Hours</option><option value="240">Half day</option></Select></label>
                </div>
              </>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800"><p className="text-[9px] text-slate-400">{taskMode === "schedule" ? "You can complete the task from the planning queue." : "You can schedule it immediately after saving."}</p><Button disabled={saving || (taskMode === "create" && !taskTitle.trim())} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{taskMode === "schedule" ? "protect this time" : "add to queue"}</Button></div>
          </form>
        </ModalShell></Portal>
      )}

      {createOpen && (
        <Portal><ModalShell title={editingId ? "edit calendar event" : "new calendar event"} onClose={() => setCreateOpen(false)}>
          <form onSubmit={createEvent} className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">Event title</span><Input autoFocus required value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Client call, focused work, review…" className={inputClass} /></label>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700"><div><p className="text-xs font-bold text-slate-700 dark:text-slate-200">All-day event</p><p className="text-[9px] text-slate-400">Deadlines and date markers</p></div><Button type="button" onClick={() => setDraftAllDay(!draftAllDay)} className={`h-6 w-11 rounded-full p-0.5 ${draftAllDay ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`}><span className={`block h-5 w-5 rounded-full bg-white transition-transform ${draftAllDay ? "translate-x-5" : ""}`} /></Button></div>
            <div className={`grid gap-3 ${draftAllDay ? "" : "sm:grid-cols-3"}`}>
              <label><span className="mb-1.5 block text-[10px] font-bold text-slate-500">Date</span><Input type="date" required value={draftDate} onChange={(event) => setDraftDate(event.target.value)} className={inputClass} /></label>
              {!draftAllDay && <><label><span className="mb-1.5 block text-[10px] font-bold text-slate-500">Starts</span><Input type="time" required value={draftStart} onChange={(event) => setDraftStart(event.target.value)} className={inputClass} /></label><label><span className="mb-1.5 block text-[10px] font-bold text-slate-500">Ends</span><Input type="time" required value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} className={inputClass} /></label></>}
            </div>
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-slate-500">Location or meeting link</span><Input value={draftLocation} onChange={(event) => setDraftLocation(event.target.value)} placeholder="Optional" className={inputClass} /></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-slate-500">Notes</span><Textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} rows={3} placeholder="Context, agenda, or preparation notes" className={inputClass} /></label>
            <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><Input type="checkbox" checked={draftAvailability === "free"} onChange={(event) => setDraftAvailability(event.target.checked ? "free" : "busy")} />Show as available</label><Button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? "save changes" : "create event"}</Button></div>
          </form>
        </ModalShell></Portal>
      )}

      {selectedEvent && (
        <Portal><ModalShell title={selectedEvent.title} onClose={() => setSelectedEvent(null)}>
          <div className="space-y-5">
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: selectedEvent.color }} /><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{sourceLabel(selectedEvent.source)}</span></div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70"><p className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white"><Clock3 className="h-4 w-4 text-blue-500" />{selectedEvent.allDay ? new Date(`${selectedEvent.startDate}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : `${new Date(selectedEvent.startAt!).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · ${formatTime(selectedEvent.startAt)}–${formatTime(selectedEvent.endAt)}`}</p><p className="mt-1 text-[10px] text-slate-400">{selectedEvent.timeZone} · {selectedEvent.availability}</p></div>
            {selectedEvent.description && <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{selectedEvent.description}</p></div>}
            {selectedEvent.location && <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Location</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedEvent.location}</p></div>}
            {(selectedEvent.projectId || selectedEvent.invoiceId || selectedEvent.taskId || selectedEvent.clientId) && <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20"><p className="text-xs font-bold text-blue-800 dark:text-blue-200">Live-linked to your workspace</p><p className="mt-1 text-[10px] leading-4 text-blue-700/70 dark:text-blue-300/70">Changes to the source record automatically update this calendar item.</p><div className="mt-2 flex flex-wrap gap-2">{selectedEvent.projectId && <Link href={`/workflow/projects/${selectedEvent.projectId}`} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[9px] font-bold text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300">Open project <ArrowRight className="h-3 w-3" /></Link>}{selectedEvent.invoiceId && <Link href="/workflow/revenue" className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[9px] font-bold text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300">Open invoices <ArrowRight className="h-3 w-3" /></Link>}{selectedEvent.clientId && !selectedEvent.projectId && <Link href={`/workflow/clients/${selectedEvent.clientId}`} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[9px] font-bold text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300">Open client <ArrowRight className="h-3 w-3" /></Link>}</div></div>}
            <div className="flex justify-end gap-2">
              {selectedEvent.source === "task" && selectedEvent.taskId && <Button onClick={() => completeTaskById(selectedEvent.taskId!)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"><Check className="h-4 w-4" />Mark complete</Button>}
              {!selectedEvent.readOnly && !["derived", "task"].includes(selectedEvent.source) && <><Button onClick={() => openEdit(selectedEvent)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300"><Pencil className="h-4 w-4" />Edit</Button><Button onClick={deleteEvent} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" />Remove</Button></>}
            </div>
          </div>
        </ModalShell></Portal>
      )}

      {connectionsOpen && (
        <Portal><ModalShell title="Calendar connections" onClose={() => setConnectionsOpen(false)} wide>
          <div className="space-y-4">
            {googleCalendarAvailable && <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"><RefreshCw className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm font-black text-slate-800 dark:text-white">Google calendar</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Two-way events, continuous updates, and calendar discovery.</p></div></div>{googleConnections.length ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Connected</span> : <a href="/api/calendar/connections/google/start" className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">Connect</a>}</div>
              {googleConnections.map((connection) => <div key={connection.id} className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-slate-700 dark:text-slate-200">{connection.accountEmail}</p><p className="mt-0.5 text-[9px] text-slate-400">{connection.lastSyncedAt ? `Synced ${new Date(connection.lastSyncedAt).toLocaleString()}` : "Initial sync pending"}</p></div><Button onClick={() => syncGoogle(connection.id)} disabled={syncing} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />Sync now</Button></div>{connection.externalCalendars.length > 0 && <div className="mt-3 grid gap-1 border-t border-slate-200 pt-2 dark:border-slate-700">{connection.externalCalendars.map((calendar) => <label key={calendar.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900"><Input type="checkbox" checked={calendar.selected} onChange={(event) => void toggleExternalCalendar(calendar.id, event.target.checked)} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: calendar.color || "#4285F4" }} /><span className="min-w-0 flex-1 truncate">{calendar.name}</span><span className="text-[8px] uppercase text-slate-400">{calendar.accessRole}</span></label>)}</div>}{connection.lastError && <div className="mt-2 flex gap-2 text-[10px] text-red-600"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{connection.lastError}</div>}</div>)}
            </section>}
            <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900"><CalendarDays className="h-5 w-5" /></div><div><p className="text-sm font-black text-slate-800 dark:text-white">Apple calendar</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Subscribe to a private, read-only feed of rive. events and deadlines.</p></div></div>
              {!feedUrl ? <Button onClick={createAppleFeed} className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:text-slate-200">Create private apple feed</Button> : <div className="mt-4"><div className="flex gap-2"><Input readOnly value={feedUrl} className={`${inputClass} min-w-0 flex-1 text-[10px]`} /><Button onClick={copyFeed} className="rounded-xl border border-slate-200 px-3 dark:border-slate-700">{copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-slate-500" />}</Button><a href={feedUrl} className="grid place-items-center rounded-xl bg-slate-900 px-3 text-white dark:bg-white dark:text-slate-900"><ExternalLink className="h-4 w-4" /></a></div><div className="mt-2 flex items-start justify-between gap-3"><p className="text-[9px] leading-4 text-slate-400">Treat this URL like a password. Regenerating it revokes the previous feed.</p><Button onClick={revokeAppleFeed} className="shrink-0 text-[9px] font-bold text-red-500 hover:underline">Revoke feed</Button></div></div>}
            </section>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300"><Settings2 className="mr-1 inline h-3.5 w-3.5" />Full Apple two-way sync requires encrypted iCloud CalDAV credentials or the future native companion app. The subscription feed is deliberately read-only.</div>
          </div>
        </ModalShell></Portal>
      )}
    </div>
  );
}

function ValueCard({ icon, tone, value, title, description }: { icon: ReactNode; tone: "blue" | "teal" | "violet" | "amber"; value: string; title: string; description: string }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300",
    teal: "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
  };
  return <div className="flex min-w-0 gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/35"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>{icon}</span><div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-2"><p className="text-xs font-black text-slate-800 dark:text-white">{title}</p><span className="text-[9px] font-bold text-slate-400">{value}</span></div><p className="mt-1 text-[9px] leading-4 text-slate-500 dark:text-slate-400">{description}</p></div></div>;
}

function ModalShell({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={onClose}><div className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 ${wide ? "max-w-2xl" : "max-w-lg"}`} onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-start justify-between gap-4"><h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2><Button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></Button></div>{children}</div></div>;
}

function MonthView({ rangeStart, groupedEvents, onCreate, onSelect }: { rangeStart: Date; groupedEvents: Map<string, CalendarEvent[]>; onCreate: (date: Date) => void; onSelect: (event: CalendarEvent) => void }) {
  const currentMonth = addDays(rangeStart, 7).getMonth();
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="grid [grid-template-columns:repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        {WEEK_DAYS.map((day) => <div key={day} className="px-1 py-2 text-center text-[9px] font-black uppercase tracking-wider text-slate-400">{day}</div>)}
      </div>
      <div className="grid [grid-template-columns:repeat(7,minmax(0,1fr))]">
        {Array.from({ length: 42 }, (_, index) => addDays(rangeStart, index)).map((date) => {
          const key = dateKey(date);
          const items = groupedEvents.get(key) || [];
          const today = key === dateKey(new Date());
          const outsideMonth = date.getMonth() !== currentMonth;
          return (
            <div
              key={key}
              onDoubleClick={() => onCreate(date)}
              className={`min-h-28 min-w-0 overflow-hidden border-b border-r border-slate-100 p-1.5 transition-colors hover:bg-blue-50/30 dark:border-slate-800 dark:hover:bg-blue-950/10 ${outsideMonth ? "bg-slate-50/50 dark:bg-slate-950/20" : ""}`}
            >
              <span className={`inline-grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${today ? "bg-blue-600 text-white" : outsideMonth ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>{date.getDate()}</span>
              <div className="mt-1 min-w-0 space-y-1">
                {items.slice(0, 3).map((event) => (
                  <Button
                    key={event.id}
                    onClick={(click) => { click.stopPropagation(); onSelect(event); }}
                    title={`${event.allDay ? "All day" : formatTime(event.startAt)} · ${event.title}`}
                    className="flex h-5 w-full min-w-0 items-center justify-start gap-1 overflow-hidden rounded-md px-1.5 text-left text-[9px] font-bold"
                    style={{ background: `${event.color}18`, color: event.color }}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: event.color }} />
                    {!event.allDay && <span className="hidden shrink-0 font-black xl:inline">{formatTime(event.startAt)}</span>}
                    <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  </Button>
                ))}
                {items.length > 3 && <span className="block truncate px-1 text-[9px] font-bold text-slate-400">+{items.length - 3} more events</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ rangeStart, events, onCreate, onSelect }: { rangeStart: Date; events: CalendarEvent[]; onCreate: (date: Date, hour: number) => void; onSelect: (event: CalendarEvent) => void }) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(rangeStart, index));
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="min-w-[780px]"><div className="grid grid-cols-[54px_repeat(7,minmax(0,1fr))] border-b border-slate-200 dark:border-slate-800"><div /><>{days.map((day) => { const today = dateKey(day) === dateKey(new Date()); return <div key={day.toISOString()} className="border-l border-slate-100 px-2 py-3 text-center dark:border-slate-800"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{WEEK_DAYS[(day.getDay() + 6) % 7]}</p><p className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-full text-xs font-black ${today ? "bg-blue-600 text-white" : "text-slate-700 dark:text-slate-200"}`}>{day.getDate()}</p></div>; })}</></div><div className="grid grid-cols-[54px_repeat(7,minmax(0,1fr))]"><div>{HOURS.map((hour) => <div key={hour} className="h-16 -translate-y-2 pr-2 text-right text-[9px] text-slate-400">{hour === 12 ? "12 pm" : hour > 12 ? `${hour - 12} pm` : `${hour} am`}</div>)}</div>{days.map((day) => { const key = dateKey(day); const dayEvents = events.filter((event) => eventDateKey(event) === key); const timed = layoutOverlappingEvents(dayEvents.filter((event) => !event.allDay && event.startAt && event.endAt)); const allDay = sortCalendarEvents(dayEvents.filter((event) => event.allDay)); return <div key={key} className="relative min-w-0 border-l border-slate-100 dark:border-slate-800"><div className="absolute left-1 right-1 top-1 z-10 space-y-1">{allDay.slice(0, 2).map((event) => <Button key={event.id} onClick={() => onSelect(event)} className="block w-full min-w-0 truncate rounded-md px-1.5 py-1 text-left text-[8px] font-bold" style={{ background: `${event.color}20`, color: event.color }}>{event.title}</Button>)}</div>{HOURS.map((hour) => <Button key={hour} onDoubleClick={() => onCreate(day, hour)} className="block h-16 w-full border-b border-slate-100 text-left hover:bg-blue-50/30 dark:border-slate-800 dark:hover:bg-blue-950/10" aria-label={`Create event ${key} at ${hour}:00`} />)}{timed.map(({ event, lane, laneCount }) => { const start = new Date(event.startAt!); const end = new Date(event.endAt!); const top = Math.max(0, ((start.getHours() * 60 + start.getMinutes()) - 420) / 60 * 64); const height = Math.max(24, (end.getTime() - start.getTime()) / 3600000 * 64); return <Button key={event.id} onClick={() => onSelect(event)} title={`${formatTime(event.startAt)} · ${event.title}`} className="absolute z-20 min-w-0 overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left shadow-sm" style={{ top, height, left: `calc(${lane * (100 / laneCount)}% + 3px)`, width: `calc(${100 / laneCount}% - 5px)`, background: `${event.color}1C`, borderColor: event.color, color: event.color }}><span className="block truncate text-[9px] font-black">{event.title}</span><span className="block truncate text-[8px] opacity-80">{formatTime(event.startAt)}</span></Button>; })}</div>; })}</div></div></div>;
}

function AgendaView({ events, onSelect }: { events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) {
  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of events) grouped.set(eventDateKey(event), [...(grouped.get(eventDateKey(event)) || []), event]);
  if (!events.length) return <div className="grid h-80 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><div className="text-center"><CalendarDays className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-500">Nothing scheduled in this range.</p></div></div>;
  return <div className="space-y-4">{Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, items]) => <section key={date} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="border-b border-slate-100 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{items.map((event) => <Button key={event.id} onClick={() => onSelect(event)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"><span className="h-8 w-1 rounded-full" style={{ background: event.color }} /><span className="w-16 text-[10px] font-bold text-slate-400">{event.allDay ? "all day" : formatTime(event.startAt)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-700 dark:text-slate-200">{event.title}</span><span className="block text-[9px] text-slate-400">{sourceLabel(event.source)}</span></span></Button>)}</div></section>)}</div>;
}
