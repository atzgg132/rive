export type DeliveryBucket = "overdue" | "this_week" | "later" | "no_deadline";

export type DeliveryTone = "overdue" | "urgent" | "normal" | "muted";

export type DeliveryStatus = {
  bucket: DeliveryBucket;
  tone: DeliveryTone;
  label: string;
};

export const DELIVERY_BUCKET_LABELS: Record<DeliveryBucket, string> = {
  overdue: "Overdue",
  this_week: "Due this week",
  later: "Scheduled later",
  no_deadline: "No deadline set",
};

/** Calendar days between two instants, ignoring the time of day on each. */
function wholeDaysBetween(from: Date, to: Date): number {
  const fromDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((toDay - fromDay) / 86_400_000);
}

function parseDueDate(dueDate: string | Date | null | undefined): Date | null {
  if (!dueDate) return null;
  const parsed = dueDate instanceof Date ? dueDate : new Date(dueDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Describes a project's deadline relative to today. A completed project is
 * never reported as overdue — the work already landed, so a past due date is
 * history rather than something needing attention.
 */
export function deliveryStatus(
  dueDate: string | Date | null | undefined,
  status: string,
  now: Date = new Date(),
): DeliveryStatus {
  const due = parseDueDate(dueDate);
  if (!due) {
    return { bucket: "no_deadline", tone: "muted", label: "No deadline" };
  }

  const dayLabel = due.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const days = wholeDaysBetween(now, due);

  if (status === "completed") {
    return { bucket: days < 0 ? "overdue" : "later", tone: "muted", label: `Due ${dayLabel}` };
  }

  if (days < 0) {
    return { bucket: "overdue", tone: "overdue", label: `Overdue by ${plural(Math.abs(days), "day")}` };
  }
  if (days === 0) return { bucket: "this_week", tone: "urgent", label: "Due today" };
  if (days === 1) return { bucket: "this_week", tone: "urgent", label: "Due tomorrow" };
  if (days <= 7) return { bucket: "this_week", tone: "urgent", label: `Due in ${plural(days, "day")}` };

  return { bucket: "later", tone: "normal", label: `Due ${dayLabel}` };
}

/**
 * Splits an already-sorted page of projects into contiguous deadline sections.
 * The caller must only use this while the list is sorted by due date, so that
 * a section is a run of neighbours rather than a claim about the whole
 * workspace — the page holds one slice, not every project.
 */
export function groupByDeliveryBucket<T>(
  items: T[],
  read: (item: T) => DeliveryStatus,
): Array<{ bucket: DeliveryBucket; items: T[] }> {
  const sections: Array<{ bucket: DeliveryBucket; items: T[] }> = [];
  for (const item of items) {
    const { bucket } = read(item);
    const current = sections.at(-1);
    if (current && current.bucket === bucket) current.items.push(item);
    else sections.push({ bucket, items: [item] });
  }
  return sections;
}

/** Completed milestones as a whole percentage, guarding against a zero total. */
export function milestoneProgress(completed: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const safeCompleted = Number.isFinite(completed) ? Math.max(0, Math.min(completed, total)) : 0;
  return Math.round((safeCompleted / total) * 100);
}
