"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { Button, Textarea } from "@/components/ui";

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
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (promptedThisSession) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/feedback/prompt?promptKey=${encodeURIComponent(promptKey)}`, { credentials: "same-origin", cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          if (data?.success && data.available) {
            promptedThisSession = true;
            setOpen(true);
          }
        })
        .catch(() => undefined);
    }, 4_500);
    return () => window.clearTimeout(timer);
  }, [promptKey]);

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
      if (!response.ok || !data?.success) throw new Error(data?.message || "Feedback could not be saved.");
      setState("sent");
      window.setTimeout(() => setOpen(false), 1_200);
    } catch (error) {
      setState("error"); setMessage(error instanceof Error ? error.message : "Feedback could not be saved.");
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2 rounded-full">
        <MessageSquare className="h-3.5 w-3.5" /> {label}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/25 p-4 sm:items-center" onClick={() => close("snooze")}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Help shape Rive</p><h2 className="mt-1 text-lg font-semibold">How is this feeling so far?</h2><p className="mt-1 text-sm text-muted-foreground">A quick note from your real workflow is more useful than a generic survey.</p></div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => close("snooze")} aria-label="Snooze feedback"><X className="h-4 w-4" /></Button>
            </div>
            <div className="mt-5 flex gap-2" aria-label="Rating from one to five">
              {[1, 2, 3, 4, 5].map((value) => <Button key={value} type="button" variant={rating === value ? "default" : "outline"} size="sm" className="h-9 w-9 rounded-full p-0" onClick={() => setRating(value)}>{value}</Button>)}
            </div>
            <Textarea value={body} onChange={(event) => setBody(event.target.value.slice(0, 4_000))} rows={4} placeholder="What was clear, confusing, or missing?" className="mt-4 resize-none" />
            <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={contactAllowed} onChange={(event) => setContactAllowed(event.target.checked)} className="mt-0.5" />You may contact me about this feedback.</label>
            {message ? <p className={`mt-3 text-xs ${state === "error" ? "text-red-600" : "text-emerald-600"}`}>{message}</p> : null}
            {state === "sent" ? <p className="mt-4 text-sm font-medium text-emerald-600">Thanks — feedback saved.</p> : <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => close("dismiss")}>Not now</Button><Button type="button" size="sm" onClick={() => void submit()} disabled={state === "sending"} className="gap-2"><Send className="h-3.5 w-3.5" />{state === "sending" ? "Saving…" : "Send feedback"}</Button></div>}
          </div>
        </div>
      ) : null}
    </>
  );
}
