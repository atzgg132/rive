"use client";

import { Button, ContextualEmptyState, Input, PageHeader, Select, Switch, Tabs, Textarea } from "@/components/ui";

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
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
  Focus,
  Info,
  Link2,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Portal from "@/components/ui/Portal";
import { CalendarConnectionsPanel } from "@/components/settings/CalendarConnectionsPanel";
import {
  addDays as addDaysToDateKey,
  canonicalTimeZone,
  instantToWallParts,
  supportedTimeZones,
  wallToInstant,
} from "@/lib/calendar-time";

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
  defaultExternalCalendarId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  externalCalendars: Array<{ id: string; providerCalendarId: string; name: string; color: string | null; selected: boolean; accessRole: string | null }>;
};


const READ_ONLY_ACCESS_ROLES = ["reader", "freeBusyReader"];

const CONNECTION_ERROR_MESSAGES: Record<string, string> = {
  invalid_google_callback: "That Google sign-in link expired or didn't match this session. Try connecting again.",
  google_not_available: "Google Calendar isn't enabled on this environment.",
  google_not_configured: "Google Calendar isn't configured correctly. Check the integration settings.",
  google_access_denied: "The Google connection was cancelled — no access was granted.",
  google_sync_failed: "Google connected, but the first sync failed. Open calendar feeds and try Sync now.",
};


type View = "month" | "week" | "agenda";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = Array.from({ length: 12 }, (_, month) => new Date(2020, month, 1).toLocaleDateString("en", { month: "short" }));
const HOURS = Array.from({ length: 15 }, (_, index) => index + 7);
const inputClass = "w-full rounded-none border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

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

function browserTimeZone(): string {
  return canonicalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? "UTC";
}

function formatTime(value: string | null, timeZone?: string): string {
  if (!value) return "";
  const zone = timeZone ? canonicalTimeZone(timeZone) : null;
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    ...(zone ? { timeZone: zone } : {}),
  }).format(new Date(value));
}

function formatEventDate(event: CalendarEvent): string {
  const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };
  const zone = canonicalTimeZone(event.timeZone);
  if (zone) options.timeZone = zone;
  return new Date(event.allDay ? `${event.startDate}T12:00:00` : event.startAt || "").toLocaleDateString("en-IN", options);
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
  const [userTimeZone, setUserTimeZone] = useState("");
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
  const [draftDate, setDraftDate] = useState(() => dateKey(new Date()));
  const [draftStart, setDraftStart] = useState("09:00");
  const [draftEnd, setDraftEnd] = useState("10:00");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftAllDay, setDraftAllDay] = useState(false);
  const [draftTimeZone, setDraftTimeZone] = useState("");
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
    const connectionError = params.get("connectionError");
    if (connectionError) {
      toast.error(CONNECTION_ERROR_MESSAGES[connectionError] || "Google Calendar could not be connected. Check the integration configuration.");
    }
  }, []);

  useEffect(() => {
    async function loadGuidePreference() {
      const response = await fetch("/api/auth/session").catch(() => null);
      const data = response?.ok ? await response.json().catch(() => null) : null;
      if (typeof data?.user?.time_zone === "string") {
        const userZone = canonicalTimeZone(data.user.time_zone);
        if (userZone) setUserTimeZone(userZone);
      }
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

  // Mirrors the server-side push-target resolution in pushEventToGoogle: an
  // event on the default calendar goes to that calendar's Google mirror when
  // it's writable, otherwise to the oldest healthy connection's default.
  const syncDestination = useMemo(() => {
    const healthy = googleConnections.filter((connection) => connection.status === "connected");
    const defaultCalendar = calendars.find((calendar) => calendar.isDefault);
    const mapped = defaultCalendar?.externalCalendars.find(
      (external) =>
        external.connection.provider === "google" &&
        external.connection.status === "connected" &&
        !READ_ONLY_ACCESS_ROLES.includes(external.accessRole || ""),
    );
    const connection = mapped
      ? healthy.find((candidate) => candidate.externalCalendars.some((external) => external.id === mapped.id))
      : healthy.find((candidate) => candidate.defaultExternalCalendarId);
    if (!connection) return null;
    const calendarName =
      mapped?.name ||
      connection.externalCalendars.find((external) => external.providerCalendarId === connection.defaultExternalCalendarId)?.name;
    return { email: connection.accountEmail, calendarName };
  }, [googleConnections, calendars]);
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
    // Wrap past midnight — the submit path reads an end ≤ start as next-day.
    setDraftEnd(`${String((hour + 1) % 24).padStart(2, "0")}:00`);
    setDraftTimeZone(userTimeZone || browserTimeZone());
    setDraftTitle("");
    setDraftDescription("");
    setDraftLocation("");
    setDraftAllDay(false);
    setDraftAvailability("busy");
    setCreateOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    if (event.readOnly || ["derived", "task"].includes(event.source)) return;
    const eventTimeZone = canonicalTimeZone(event.timeZone) ?? (userTimeZone || browserTimeZone());
    setEditingId(event.id);
    setDraftTitle(event.title);
    setDraftDescription(event.description || "");
    setDraftLocation(event.location || "");
    setDraftAllDay(event.allDay);
    setDraftTimeZone(eventTimeZone);
    setDraftAvailability(event.availability === "free" ? "free" : "busy");
    if (event.allDay && event.startDate) {
      setDraftDate(event.startDate);
    } else if (event.startAt && event.endAt) {
      // Show wall times in the event's own zone so editing a Tokyo event from
      // a Kolkata browser doesn't shift what "15:00" means.
      const start = instantToWallParts(event.startAt, eventTimeZone);
      const end = instantToWallParts(event.endAt, eventTimeZone);
      if (start && end) {
        setDraftDate(start.date);
        setDraftStart(start.time);
        setDraftEnd(end.time);
      }
    }
    setSelectedEvent(null);
    setCreateOpen(true);
  }

  async function createEvent(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const timeZone = draftTimeZone || userTimeZone || browserTimeZone();
      let payload: Record<string, unknown>;
      if (draftAllDay) {
        payload = {
          title: draftTitle,
          description: draftDescription,
          location: draftLocation,
          allDay: true,
          startDate: draftDate,
          endDate: addDaysToDateKey(draftDate, 1),
          timeZone,
          availability: draftAvailability,
        };
      } else {
        // Wall times are interpreted in the chosen zone. An end at or before
        // the start is an overnight event — it lands on the next day.
        const startAt = wallToInstant(draftDate, draftStart, timeZone);
        const endDay = draftEnd <= draftStart ? addDaysToDateKey(draftDate, 1) : draftDate;
        const endAt = wallToInstant(endDay, draftEnd, timeZone);
        if (!startAt || !endAt) throw new Error("Check the event date and times.");
        payload = {
          title: draftTitle,
          description: draftDescription,
          location: draftLocation,
          allDay: false,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          timeZone,
          availability: draftAvailability,
        };
      }
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
          timeZone: browserTimeZone(),
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
        className="sm:flex-col xl:flex-row"
        title="Your work, on one timeline"
        description="Plan meetings and focus time alongside project deadlines, tasks, milestones, and invoice due dates."
        actions={<>
          {guideReady && !showGuide && <Button variant="ghost" onClick={() => setShowGuide(true)} className="hidden sm:inline-flex"><Info /> How it connects</Button>}
          <Button data-guide-target="calendar-connect" variant="outline" onClick={() => setConnectionsOpen(true)}><span className={`h-2 w-2 rounded-full ${visibleConnections.length && visibleConnections.every((connection) => connection.status === "connected") ? "bg-success" : "bg-warning"}`} /><Link2 /> {visibleConnections.length ? `${connectedCalendars} synced` : "Calendar feeds"}</Button>
          <Button variant="outline" onClick={openTaskComposer} className="hidden sm:inline-flex"><ListTodo /> Add task</Button>
          <Button onClick={() => openCreate()}><Plus /> New event</Button>
        </>}
      />

      {guideReady && showGuide && <section className="rounded-none border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-black text-foreground">How work reaches your calendar</p><p className="mt-0.5 text-xs text-muted-foreground">Dates stay connected to their source records, so you only update them once.</p></div>
          <Button variant="outline" size="sm" onClick={dismissGuide} className="inline-flex items-center gap-1.5"><X className="h-3 w-3" />Got it, hide this</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ValueCard icon={<Briefcase className="h-4 w-4" />} tone="primary" value={`${deadlineCount} deadlines scheduled`} title="Projects & milestones" description="Project dates and unfinished milestones update here when the source record changes." />
          <ValueCard icon={<Timer className="h-4 w-4" />} tone="info" value={`${Math.round(scheduledFocusMinutes / 60 * 10) / 10}h protected`} title="Tasks & focus time" description="Turn due tasks into focus blocks, then complete them from the same plan." />
          <ValueCard icon={<CircleDollarSign className="h-4 w-4" />} tone="warning" value="Invoice dates included" title="Revenue & invoices" description="Unpaid invoice due dates stay visible beside the work that generated them." />
          <ValueCard icon={<Cloud className="h-4 w-4" />} tone="accent" value={visibleConnections.length ? `${connectedCalendars} calendars active` : "Ready to connect"} title={googleCalendarAvailable ? "Google & Apple" : "Apple calendar"} description={googleCalendarAvailable ? "rive. events sync both ways with Google; Apple receives the combined feed." : "Apple can receive a private, read-only feed of rive. events and deadlines."} />
        </div>
        {!visibleConnections.length && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-none border border-border bg-accent px-4 py-3">
            <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-none bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span><div><p className="text-xs font-black text-foreground">See Rive alongside your other calendars</p><p className="mt-0.5 text-xs text-muted-foreground">{googleCalendarAvailable ? "Connect Google Calendar for two-way sync, or add a private Rive feed to Apple Calendar." : "Add a private Rive feed to Apple Calendar."}</p></div></div>
            <Button variant="default" size="sm" data-guide-target="calendar-connect" onClick={() => setConnectionsOpen(true)} className="inline-flex items-center gap-1.5">Connect calendar <ArrowRight className="h-3.5 w-3.5" /></Button>
          </div>
        )}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Client details provide context through projects and invoices. Expenses and portfolio publishing stay out of the calendar.</p>
      </section>}

      <div className="grid min-h-[calc(100vh-300px)] 2xl:grid-cols-[210px_minmax(0,1fr)_270px]">
        <aside className="hidden border-r border-border bg-card p-4 2xl:block">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())} className="mb-5 w-full">Today</Button>
          <p className="mb-2 px-1 text-xs font-bold text-muted-foreground">My calendars</p>
          <div className="space-y-1">
            {calendars.map((calendar) => (
              <label key={calendar.id} className="flex cursor-pointer items-center gap-2 rounded-none px-2 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[.05]">
                <Input type="checkbox" checked={visibleCalendars.has(calendar.id)} onChange={() => setVisibleCalendars((current) => {
                  const next = new Set(current);
                  if (next.has(calendar.id)) next.delete(calendar.id); else next.add(calendar.id);
                  return next;
                })} className="sr-only" />
                <span className={`grid h-4 w-4 place-items-center rounded border ${visibleCalendars.has(calendar.id) ? "border-transparent" : "border-border"}`} style={{ background: visibleCalendars.has(calendar.id) ? calendar.color : "transparent", color: "white" }}>{visibleCalendars.has(calendar.id) && <Check className="h-3 w-3" />}</span>
                <span className="min-w-0 flex-1 truncate">{calendar.name}</span>
                {calendar.externalCalendars.length > 0 && <span className="text-xs uppercase text-muted-foreground">{calendar.externalCalendars[0].connection.provider}</span>}
              </label>
            ))}
          </div>
          <div className="mt-6 rounded-none border border-info/25 bg-info/10 p-3">
            <p className="text-xs font-bold text-info">Always up to date</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Project deadlines, tasks, and invoice dates stay in sync with their source records.</p>
          </div>
        </aside>

        <main id="planning-queue" className="min-w-0 p-3 sm:p-5 lg:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => moveCursor(-1)} aria-label="Previous date range"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => moveCursor(1)} aria-label="Next date range"><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date())} className="ml-1">Today</Button>
              <div className="ml-1 inline-flex items-center gap-1 rounded-none border border-border bg-card px-2 py-1.5 text-xs font-bold text-foreground hover:border-primary/60">
                <CalendarRange className="h-3.5 w-3.5 text-primary" />
                <Select aria-label="Select month" value={cursor.getMonth()} onChange={(event) => selectMonth(Number(event.target.value))} className="h-auto w-auto border-0 bg-transparent p-0 text-xs font-bold shadow-none outline-none focus-visible:ring-0">{MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}</Select>
                <Input aria-label="Select year" type="number" min="1970" max="2100" value={cursor.getFullYear()} onChange={(event) => selectYear(Number(event.target.value))} className="h-auto w-12 border-0 bg-transparent p-0 font-mono text-xs font-bold tabular-nums shadow-none outline-none [appearance:textfield] focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </div>
              <h2 className="ml-2 text-sm font-black text-foreground">{title}</h2>
            </div>
            <Tabs options={[{ id: "month", label: "month" }, { id: "week", label: "week" }, { id: "agenda", label: "agenda" }]} value={view} onChange={(id) => setView(id as View)} />

          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Double-click a day or time slot to add an event.</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-info" />Scheduled tasks appear as focus blocks.</span>
          </div>

          {loading ? (
            <div className="grid h-[560px] place-items-center rounded-none border border-border bg-card"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : view === "month" ? (
            <MonthView rangeStart={range.start} groupedEvents={groupedEvents} onCreate={openCreate} onSelect={setSelectedEvent} />
          ) : view === "week" ? (
            <WeekView rangeStart={range.start} events={visibleEvents} onCreate={openCreate} onSelect={setSelectedEvent} />
          ) : (
            <AgendaView events={visibleEvents} onSelect={setSelectedEvent} />
          )}
          <section className="mt-4 rounded-none border border-border bg-card p-4 2xl:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-black text-foreground">Planning queue</p><p className="mt-0.5 text-xs text-muted-foreground">Turn unfinished tasks into protected focus blocks.</p></div>
              <Button variant="outline" size="sm" onClick={openTaskComposer} className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" />Add task</Button>
            </div>
            {unscheduledTasks.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{unscheduledTasks.slice(0, 6).map((task) => <div key={task.id} className="flex items-center gap-3 rounded-none border border-border p-3"><Button onClick={() => completeTask(task)} aria-label={`Complete ${task.title}`} className="h-4 w-4 shrink-0 rounded-full border border-border hover:border-success hover:bg-success/10" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-foreground">{task.title}</p><p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{task.estimatedMinutes || 60} min{task.dueDate ? ` · due ${new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}</p></div><Button onClick={() => openTaskScheduler(task)} className="rounded-none bg-info/10 px-2 py-1.5 text-xs font-bold text-info">Schedule</Button></div>)}</div> : <p className="mt-3 rounded-none border border-dashed border-border py-4 text-center text-xs text-muted-foreground">Nothing waiting. Your current plan is fully scheduled.</p>}
          </section>
        </main>

        <aside className="hidden border-t border-border bg-card p-4 2xl:block 2xl:border-l 2xl:border-t-0">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="text-xs font-black text-foreground">Planning queue</p><p className="mt-0.5 text-xs text-muted-foreground">Give every task a home</p></div>
            <ListTodo className="h-4 w-4 text-info" />
          </div>
          {unscheduledTasks.length === 0 ? (
            <div className="rounded-none border border-dashed border-border p-4 text-center"><Focus className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-2 text-xs font-bold text-muted-foreground">Your plan is clear.</p><p className="mt-1 text-xs leading-4 text-muted-foreground">New tasks wait here until you reserve time for them.</p></div>
          ) : (
            <div className="space-y-2">
              {unscheduledTasks.slice(0, 8).map((task) => (
                <div key={task.id} className="group rounded-none border border-border p-3">
                  <div className="flex items-start gap-2">
                    <Button onClick={() => completeTask(task)} aria-label={`Complete ${task.title}`} className="mt-0.5 h-4 w-4 rounded-full border border-border hover:border-success hover:bg-success/10" />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-foreground">{task.title}</p>{task.project && <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.project.title}</p>}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2 font-mono text-xs tabular-nums text-muted-foreground">{task.estimatedMinutes && <span>{task.estimatedMinutes} min</span>}{task.dueDate && <span>due {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}</div><Button onClick={() => openTaskScheduler(task)} className="inline-flex items-center gap-1 rounded-none bg-info/10 px-2 py-1 text-xs font-bold text-info hover:bg-info/20"><Clock3 className="h-3 w-3" />Schedule</Button></div>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={openTaskComposer} className="mt-3 flex w-full items-center justify-center gap-1.5"><Plus className="h-3.5 w-3.5" />Add task</Button>
        </aside>
      </div>

      {taskMode && (
        <Portal><ModalShell title={taskMode === "schedule" ? "protect time for this task" : "add work to your planning queue"} onClose={() => setTaskMode(null)}>
          <form onSubmit={saveTask} className="space-y-4">
            {taskMode === "create" ? (
              <>
                <div className="rounded-none border border-info/25 bg-info/10 p-3"><p className="text-xs font-bold text-info">Capture now. Schedule when you are ready.</p><p className="mt-1 text-xs leading-4 text-info/80">The task enters your planning queue, where you can turn it into a focused block on the calendar.</p></div>
                <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">What needs to get done?</span><Input autoFocus required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Prepare client proposal" className={inputClass} /></label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Priority</span><Select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)} className={inputClass}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></Select></label>
                  <label><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Due date</span><Input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} className={inputClass} /></label>
                  <label><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Estimate</span><Select value={taskEstimate} onChange={(event) => setTaskEstimate(event.target.value)} className={inputClass}><option value="30">30 Min</option><option value="60">1 Hour</option><option value="90">1.5 Hours</option><option value="120">2 Hours</option><option value="240">Half day</option></Select></label>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-none border border-info/25 bg-info/10 p-4"><p className="text-xs font-black uppercase tracking-wider text-info">Focus block</p><p className="mt-1 text-sm font-black text-foreground">{taskToSchedule?.title}</p><p className="mt-1 text-xs leading-4 text-muted-foreground">rive. will reserve this time as busy and keep the block linked to the original task.</p></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Date</span><Input type="date" required value={taskScheduleDate} onChange={(event) => setTaskScheduleDate(event.target.value)} className={inputClass} /></label>
                  <label><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Starts</span><Input type="time" required value={taskScheduleStart} onChange={(event) => setTaskScheduleStart(event.target.value)} className={inputClass} /></label>
                  <label><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Duration</span><Select value={taskEstimate} onChange={(event) => setTaskEstimate(event.target.value)} className={inputClass}><option value="30">30 Min</option><option value="60">1 Hour</option><option value="90">1.5 Hours</option><option value="120">2 Hours</option><option value="240">Half day</option></Select></label>
                </div>
              </>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4"><p className="text-xs text-muted-foreground">{taskMode === "schedule" ? "You can complete the task from the planning queue." : "You can schedule it immediately after saving."}</p><Button variant="default" size="sm" type="submit" disabled={saving || (taskMode === "create" && !taskTitle.trim())} className="inline-flex items-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{taskMode === "schedule" ? "protect this time" : "add to queue"}</Button></div>
          </form>
        </ModalShell></Portal>
      )}

      {createOpen && (
        <Portal><ModalShell title={editingId ? "edit calendar event" : "new calendar event"} onClose={() => setCreateOpen(false)}>
          <form onSubmit={createEvent} className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">Event title</span><Input autoFocus required value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Client call, focused work, review…" className={inputClass} /></label>
            <label className="flex cursor-pointer items-center justify-between rounded-none border border-border bg-card px-3 py-2.5 text-card-foreground transition-colors hover:bg-muted/[0.35]"><span><span className="block text-xs font-bold text-foreground">All-day event</span><span className="mt-0.5 block text-xs text-muted-foreground">Deadlines and date markers</span></span><Switch aria-label="All-day event" checked={draftAllDay} onCheckedChange={setDraftAllDay} /></label>
            <div className={`grid gap-3 ${draftAllDay ? "" : "sm:grid-cols-3"}`}>
              <label><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Date</span><Input type="date" required value={draftDate} onChange={(event) => setDraftDate(event.target.value)} className={inputClass} /></label>
              {!draftAllDay && <><label><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Starts</span><Input type="time" required value={draftStart} onChange={(event) => setDraftStart(event.target.value)} className={inputClass} /></label><label><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Ends{draftEnd <= draftStart ? <span className="ml-1 font-semibold text-info">(+1 day)</span> : null}</span><Input type="time" required value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} className={inputClass} /></label></>}
            </div>
            {!draftAllDay && (
              <label className="block"><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Timezone</span><Select value={draftTimeZone} onChange={(event) => setDraftTimeZone(event.target.value)} className={inputClass}>{supportedTimeZones().map((zone) => <option key={zone} value={zone}>{zone}</option>)}</Select></label>
            )}
            {syncDestination && !editingId ? <p className="text-xs text-muted-foreground">New events sync to {syncDestination.calendarName || "the primary calendar"} on {syncDestination.email || "your Google account"}.</p> : null}
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Location or meeting link</span><Input value={draftLocation} onChange={(event) => setDraftLocation(event.target.value)} placeholder="Optional" className={inputClass} /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-muted-foreground">Notes</span><Textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} rows={3} placeholder="Context, agenda, or preparation notes" className={inputClass} /></label>
            <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Input type="checkbox" checked={draftAvailability === "free"} onChange={(event) => setDraftAvailability(event.target.checked ? "free" : "busy")} />Show as available</label><Button variant="default" size="sm" type="submit" disabled={saving} className="inline-flex items-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? "save changes" : "create event"}</Button></div>
          </form>
        </ModalShell></Portal>
      )}

      {selectedEvent && (
        <Portal><ModalShell title={selectedEvent.title} onClose={() => setSelectedEvent(null)}>
          <div className="space-y-5">
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: selectedEvent.color }} /><span className="text-xs font-black uppercase tracking-wider text-muted-foreground">{sourceLabel(selectedEvent.source)}</span></div>
            <div className="rounded-none bg-muted p-4"><p className="flex items-center gap-2 text-sm font-bold text-foreground"><Clock3 className="h-4 w-4 text-primary" />{selectedEvent.allDay ? formatEventDate(selectedEvent) : `${formatEventDate(selectedEvent)} · ${formatTime(selectedEvent.startAt, selectedEvent.timeZone)}–${formatTime(selectedEvent.endAt, selectedEvent.timeZone)}`}</p><p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{canonicalTimeZone(selectedEvent.timeZone) ?? selectedEvent.timeZone} · {selectedEvent.availability}</p></div>
            {selectedEvent.description && <div><p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{selectedEvent.description}</p></div>}
            {selectedEvent.location && <div><p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Location</p><p className="mt-1 text-sm text-muted-foreground">{selectedEvent.location}</p></div>}
            {(selectedEvent.projectId || selectedEvent.invoiceId || selectedEvent.taskId || selectedEvent.clientId) && <div className="rounded-none border border-info/25 bg-info/10 p-3"><p className="text-xs font-bold text-info">Live-linked to your workspace</p><p className="mt-1 text-xs leading-4 text-info/80">Changes to the source record automatically update this calendar item.</p><div className="mt-2 flex flex-wrap gap-2">{selectedEvent.projectId && <Link href={`/workflow/projects/${selectedEvent.projectId}`} className="inline-flex items-center gap-1 rounded-none bg-card px-2.5 py-1.5 text-xs font-bold text-info">Open project <ArrowRight className="h-3 w-3" /></Link>}{selectedEvent.invoiceId && <Link href="/workflow/revenue" className="inline-flex items-center gap-1 rounded-none bg-card px-2.5 py-1.5 text-xs font-bold text-info">Open invoices <ArrowRight className="h-3 w-3" /></Link>}{selectedEvent.clientId && !selectedEvent.projectId && <Link href={`/workflow/clients/${selectedEvent.clientId}`} className="inline-flex items-center gap-1 rounded-none bg-card px-2.5 py-1.5 text-xs font-bold text-info">Open client <ArrowRight className="h-3 w-3" /></Link>}</div></div>}
            <div className="flex justify-end gap-2">
              {selectedEvent.source === "task" && selectedEvent.taskId && <Button onClick={() => completeTaskById(selectedEvent.taskId!)} className="inline-flex items-center gap-2 rounded-none bg-success px-4 py-2 text-xs font-bold text-success-foreground hover:opacity-90"><Check className="h-4 w-4" />Mark complete</Button>}
              {!selectedEvent.readOnly && !["derived", "task"].includes(selectedEvent.source) && <><Button variant="outline" size="sm" onClick={() => openEdit(selectedEvent)} className="inline-flex items-center gap-2"><Pencil className="h-4 w-4" />Edit</Button><Button onClick={deleteEvent} className="inline-flex items-center gap-2 rounded-none border border-destructive/40 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" />Remove</Button></>}
            </div>
          </div>
        </ModalShell></Portal>
      )}

      {connectionsOpen && (
        <Portal><ModalShell title="Calendar connections" onClose={() => setConnectionsOpen(false)} wide>
          <CalendarConnectionsPanel onChange={() => void loadWorkspace()} />
        </ModalShell></Portal>
      )}
    </div>
  );
}

function ValueCard({ icon, tone, value, title, description }: { icon: ReactNode; tone: "primary" | "info" | "accent" | "warning"; value: string; title: string; description: string }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    accent: "bg-accent text-accent-foreground",
    warning: "bg-warning/10 text-warning",
  };
  return <div className="flex min-w-0 gap-3 rounded-none border border-border bg-muted p-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-none ${tones[tone]}`}>{icon}</span><div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-2"><p className="text-xs font-black text-foreground">{title}</p><span className="text-xs font-bold text-muted-foreground">{value}</span></div><p className="mt-1 text-xs leading-4 text-muted-foreground">{description}</p></div></div>;
}

function ModalShell({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-foreground/50 p-4 backdrop-blur-sm" onMouseDown={onClose}><div className={`max-h-[90vh] w-full overflow-y-auto rounded-none border border-border bg-popover p-5 shadow-overlay ${wide ? "max-w-2xl" : "max-w-lg"}`} onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-start justify-between gap-4"><h2 className="text-lg font-extrabold tracking-[-0.03em] text-foreground">{title}</h2><Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button></div>{children}</div></div>;
}

function MonthView({ rangeStart, groupedEvents, onCreate, onSelect }: { rangeStart: Date; groupedEvents: Map<string, CalendarEvent[]>; onCreate: (date: Date) => void; onSelect: (event: CalendarEvent) => void }) {
  const currentMonth = addDays(rangeStart, 7).getMonth();
  return (
    <div className="overflow-hidden rounded-none border border-border bg-card">
      <div className="grid [grid-template-columns:repeat(7,minmax(0,1fr))] border-b border-border bg-muted">
        {WEEK_DAYS.map((day) => <div key={day} className="px-1 py-2 text-center text-xs font-black uppercase tracking-wider text-muted-foreground">{day}</div>)}
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
              className={`min-h-28 min-w-0 overflow-hidden border-b border-r border-border p-1.5 transition-colors hover:bg-accent ${outsideMonth ? "bg-muted/50" : ""}`}
            >
              <span className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${today ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{date.getDate()}</span>
              <div className="mt-1 min-w-0 space-y-1">
                {items.slice(0, 3).map((event) => (
                  <Button
                    key={event.id}
                    onClick={(click) => { click.stopPropagation(); onSelect(event); }}
                    title={`${event.allDay ? "All day" : formatTime(event.startAt)} · ${event.title}`}
                    className="flex h-5 w-full min-w-0 items-center justify-start gap-1 overflow-hidden rounded-none px-1.5 text-left text-xs font-bold"
                    style={{ background: `${event.color}18`, color: event.color }}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: event.color }} />
                    {!event.allDay && <span className="hidden shrink-0 font-mono font-black tabular-nums xl:inline">{formatTime(event.startAt)}</span>}
                    <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  </Button>
                ))}
                {items.length > 3 && <span className="block truncate px-1 text-xs font-bold text-muted-foreground">+{items.length - 3} more events</span>}
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
  return (
    <div className="overflow-x-auto rounded-none border border-border bg-card">
      <div className="min-w-[640px]">
        <div data-calendar-week-header className="grid grid-cols-[58px_repeat(7,minmax(0,1fr))] border-b border-border">
          <div aria-hidden="true" />
          {days.map((day) => {
            const today = dateKey(day) === dateKey(new Date());
            return (
              <div key={day.toISOString()} className="border-l border-border px-2 py-3 text-center">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{WEEK_DAYS[(day.getDay() + 6) % 7]}</p>
                <p className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-full text-xs font-black ${today ? "bg-primary text-primary-foreground" : "text-foreground"}`}>{day.getDate()}</p>
              </div>
            );
          })}
        </div>
        <div data-calendar-week-body className="grid grid-cols-[58px_repeat(7,minmax(0,1fr))]">
          <div className="bg-muted">
            {HOURS.map((hour) => (
              <div key={hour} className="h-16 pr-3 pt-2 text-right">
                <span data-calendar-hour-label={hour} className="inline-block font-mono text-xs font-medium tabular-nums leading-none text-muted-foreground">
                  {hour === 12 ? "12 pm" : hour > 12 ? `${hour - 12} pm` : `${hour} am`}
                </span>
              </div>
            ))}
          </div>
          {days.map((day) => {
            const key = dateKey(day);
            const dayEvents = events.filter((event) => eventDateKey(event) === key);
            // The grid spans 07:00–22:00. Events outside it used to be clamped
            // onto the 7 AM slot; now anything fully out of range renders as a
            // chip in the top strip with its real time, and partial overlaps
            // are clipped to the visible window.
            const GRID_START_MIN = 420;
            const GRID_END_MIN = 1320;
            const GRID_HEIGHT = HOURS.length * 64;
            const timedEvents = dayEvents.filter((event) => !event.allDay && event.startAt && event.endAt);
            const timedRange = (event: CalendarEvent) => {
              const start = new Date(event.startAt!);
              const end = new Date(event.endAt!);
              const startMin = dateKey(start) === key ? start.getHours() * 60 + start.getMinutes() : 0;
              const endMin = dateKey(end) === key ? end.getHours() * 60 + end.getMinutes() : 24 * 60;
              return { startMin, endMin };
            };
            const inGrid = timedEvents.filter((event) => {
              const { startMin, endMin } = timedRange(event);
              return startMin < GRID_END_MIN && endMin > GRID_START_MIN;
            });
            const outsideGrid = timedEvents.filter((event) => !inGrid.includes(event));
            const timed = layoutOverlappingEvents(inGrid);
            const allDay = sortCalendarEvents(dayEvents.filter((event) => event.allDay));
            const stripEvents = [...allDay, ...outsideGrid];
            return (
              <div key={key} className={`relative min-w-0 border-l border-border ${key === dateKey(new Date()) ? "bg-accent/40" : ""}`}>
                <div className="absolute left-1 right-1 top-1 z-10 space-y-1">
                  {stripEvents.slice(0, 2).map((event) => (
                    <Button key={event.id} onClick={() => onSelect(event)} title={`${event.allDay ? "All day" : formatTime(event.startAt)} · ${event.title}`} className="block w-full min-w-0 truncate rounded-none px-1.5 py-1 text-left text-xs font-bold" style={{ background: `${event.color}20`, color: event.color }}>{event.allDay ? event.title : `${formatTime(event.startAt)} · ${event.title}`}</Button>
                  ))}
                  {stripEvents.length > 2 && <span className="block truncate px-1 text-xs font-bold text-muted-foreground">+{stripEvents.length - 2} more</span>}
                </div>
                {HOURS.map((hour) => (
                  <Button key={hour} onDoubleClick={() => onCreate(day, hour)} className="block h-16 w-full rounded-none border-b border-border text-left hover:bg-accent" aria-label={`Create event ${key} at ${hour}:00`} />
                ))}
                {timed.map(({ event, lane, laneCount }) => {
                  const { startMin, endMin } = timedRange(event);
                  const top = Math.max(0, ((startMin - GRID_START_MIN) / 60) * 64);
                  const bottom = Math.min(GRID_HEIGHT, ((endMin - GRID_START_MIN) / 60) * 64);
                  const height = Math.max(24, bottom - top);
                  return (
                    <Button key={event.id} onClick={() => onSelect(event)} title={`${formatTime(event.startAt)} · ${event.title}`} className="absolute z-20 min-w-0 overflow-hidden rounded-none border-l-[3px] px-1.5 py-1 text-left" style={{ top, height, left: `calc(${lane * (100 / laneCount)}% + 3px)`, width: `calc(${100 / laneCount}% - 5px)`, background: `${event.color}1C`, borderColor: event.color, color: event.color }}>
                      <span className="block truncate text-xs font-black">{event.title}</span>
                      <span className="block truncate font-mono text-xs tabular-nums opacity-80">{formatTime(event.startAt)}</span>
                    </Button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgendaView({ events, onSelect }: { events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) {
  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of events) grouped.set(eventDateKey(event), [...(grouped.get(eventDateKey(event)) || []), event]);
  if (!events.length) return <ContextualEmptyState icon={<CalendarDays className="h-6 w-6" />} title="Your work will show up here" description="Project milestones, invoice deadlines, and scheduled work stay connected in Calendar." why="Calendar turns the work you entered elsewhere into a plan for your time." next="Create a project with a deadline or connect a calendar." after="Rive will surface the next dates here automatically." action={<Link href="/workflow/projects?new=true" className="inline-flex items-center rounded-none bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Create project</Link>} className="min-h-80 border-border bg-card" />;
  return <div className="space-y-4">{Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, items]) => <section key={date} className="overflow-hidden rounded-none border border-border bg-card"><div className="border-b border-border bg-muted px-4 py-2"><p className="font-mono text-xs font-black uppercase tabular-nums tracking-wider text-muted-foreground">{new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p></div><div className="divide-y divide-border">{items.map((event) => <Button key={event.id} onClick={() => onSelect(event)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[.05]"><span className="h-8 w-1 rounded-full" style={{ background: event.color }} /><span className="w-16 font-mono text-xs font-bold tabular-nums text-muted-foreground">{event.allDay ? "all day" : formatTime(event.startAt)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-foreground">{event.title}</span><span className="block text-xs text-muted-foreground">{sourceLabel(event.source)}</span></span></Button>)}</div></section>)}</div>;
}
