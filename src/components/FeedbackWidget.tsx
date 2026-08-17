"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, MessageSquare, Send, X } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { formatCooldownClock } from "@/utils/feedback";

type Props = {
  promptKey?: string;
  module?: string;
  triggerEvent?: string;
  label?: string;
};

/* `promptKey` is derived from the current path, so this component's effect
   re-runs every time the visitor moves between dashboard sections. One
   automatic prompt per page load is the most anyone should meet. The server's
   cooldown is the durable rule; this only stops a second modal appearing a few
   seconds after the first was closed. Module scope, so it resets on reload. */
let promptedThisSession = false;

export default function FeedbackWidget({ promptKey = "workspace_general", module = "workspace", triggerEvent = "workspace_viewed", label = "Share feedback" }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [contactAllowed, setContactAllowed] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "cooldown">("idle");
  const [message, setMessage] = useState("");
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  /* Ticks the countdown while the panel is open and the wait is on, and clears
     itself the moment the wait is over so the form comes straight back without
     a reload. */
  useEffect(() => {
    if (state !== "cooldown" || retryAt === null) return;
    const tick = () => {
      const left = Math.ceil((retryAt - Date.now()) / 1000);
      if (left <= 0) {
        setState("idle");
        setRetryAt(null);
        setMessage("");
        setRemaining(0);
        return;
      }
      setRemaining(left);
    };
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [retryAt, state]);

  /* Asks the server whether the day's one submission is already spent, and puts
     the panel straight into its waiting state if so. Returns whether the wait is
     on, so callers can decide not to open at all. */
  const syncCooldown = useCallback(async () => {
    try {
      const response = await fetch("/api/feedback/cooldown", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (!data?.success || !data.active) return false;
      setRetryAt(data.retryAt ? new Date(data.retryAt).getTime() : Date.now() + (data.retryAfterSeconds ?? 0) * 1_000);
      setMessage(data.message || "");
      setState("cooldown");
      return true;
    } catch {
      // Unreachable server: let them type. The POST is the real gate anyway.
      return false;
    }
  }, []);

  useEffect(() => {
    if (promptedThisSession) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        /* Checked before the prompt endpoint, which records an impression:
           inviting feedback that cannot be sent today wastes the invitation as
           well as the person's time. */
        if (await syncCooldown()) return;
        const data = await fetch(`/api/feedback/prompt?promptKey=${encodeURIComponent(promptKey)}`, { credentials: "same-origin", cache: "no-store" })
          .then((response) => response.json())
          .catch(() => null);
        if (data?.success && data.available) {
          promptedThisSession = true;
          setOpen(true);
        }
      })();
    }, 4_500);
    return () => window.clearTimeout(timer);
  }, [promptKey, syncCooldown]);

  const close = (action: "dismiss" | "snooze") => {
    setOpen(false);
    void fetch("/api/feedback/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptKey, action }) }).catch(() => undefined);
  };

  const submit = async () => {
    if (!rating && !body.trim()) { setState("error"); setMessage("Add a rating or a short note first."); return; }
    setState("sending"); setMessage("");
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptKey, module, triggerEvent, rating, body, contactAllowed, context: { path: window.location.pathname, module, trigger: triggerEvent } }) });
      const data = await response.json().catch(() => null);
      // Already sent something today: not an error, just a wait. Told plainly,
      // with the draft left intact so nothing anyone typed is thrown away.
      if (response.status === 429 && data?.reason === "cooldown") {
        setRetryAt(data.retryAt ? new Date(data.retryAt).getTime() : Date.now() + (data.retryAfterSeconds ?? 0) * 1_000);
        setMessage(data.message || "You've already shared feedback today.");
        setState("cooldown");
        return;
      }
      if (!response.ok || !data?.success) throw new Error(data?.message || "Feedback could not be saved.");
      setState("sent");
      window.setTimeout(() => setOpen(false), 1_200);
    } catch (error) {
      setState("error"); setMessage(error instanceof Error ? error.message : "Feedback could not be saved.");
    }
  };

  /* Anything they have already put in stays on screen through a cooldown. With
     nothing typed there is no draft to protect, and an empty form under a
     "come back tomorrow" notice only invites work that cannot be sent. */
  const hasDraft = rating !== null || body.trim().length > 0;
  const waiting = state === "cooldown";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => { setOpen(true); void syncCooldown(); }}
        className="gap-2 rounded-full"
      >
        <MessageSquare className="h-3.5 w-3.5" /> {label}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/25 p-4 sm:items-center" onClick={() => close("snooze")}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Help shape Rive</p><h2 className="mt-1 text-lg font-semibold">{waiting ? "Thanks — that is today's note" : "How is this feeling so far?"}</h2><p className="mt-1 text-sm text-muted-foreground">{waiting ? "Rive takes one piece of feedback per day from each account, so every note gets read properly." : "A quick note from your real workflow is more useful than a generic survey."}</p></div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => close("snooze")} aria-label="Snooze feedback"><X className="h-4 w-4" /></Button>
            </div>
            {(!waiting || hasDraft) && (
              <>
                <div className="mt-5 flex gap-2" aria-label="Rating from one to five">
                  {[1, 2, 3, 4, 5].map((value) => <Button key={value} type="button" variant={rating === value ? "default" : "outline"} size="sm" className="h-9 w-9 rounded-full p-0" disabled={waiting} onClick={() => setRating(value)}>{value}</Button>)}
                </div>
                <Textarea value={body} onChange={(event) => setBody(event.target.value.slice(0, 4_000))} rows={4} readOnly={waiting} placeholder="What was clear, confusing, or missing?" className="mt-4 resize-none" />
                <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={contactAllowed} disabled={waiting} onChange={(event) => setContactAllowed(event.target.checked)} className="mt-0.5" />You may contact me about this feedback.</label>
              </>
            )}
            {waiting ? (
              <div role="status" data-feedback-cooldown className="mt-4 rounded-xl border border-border bg-muted/50 p-4">
                <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  You can share feedback again in{" "}
                  <span className="font-bold tabular-nums text-foreground">{formatCooldownClock(remaining)}</span>
                </p>
                <p className="mt-1.5 pl-6 text-xs leading-5 text-muted-foreground">
                  {hasDraft
                    ? "Your note is still here if you want to keep it for then."
                    : "The form comes back on its own when the wait is over — no need to reload."}
                </p>
              </div>
            ) : message ? (
              <p className={`mt-3 text-xs ${state === "error" ? "text-red-600" : "text-emerald-600"}`}>{message}</p>
            ) : null}
            {state === "sent" ? <p className="mt-4 text-sm font-medium text-emerald-600">Thanks — feedback saved.</p> : <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => close("dismiss")}>{waiting ? "Close" : "Not now"}</Button>{!waiting && <Button type="button" size="sm" onClick={() => void submit()} disabled={state === "sending"} className="gap-2"><Send className="h-3.5 w-3.5" />{state === "sending" ? "Saving…" : "Send feedback"}</Button>}</div>}
          </div>
        </div>
      ) : null}
    </>
  );
}
