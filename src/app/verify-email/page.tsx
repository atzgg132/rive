"use client";

import { Button } from "@/components/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react";
import RiveLogo from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

type State = "checking" | "pending" | "success" | "error";

export default function VerifyEmailPage() {
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState("");
  const [destination, setDestination] = useState("/onboarding");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const pendingEmail = params.get("email");
      if (pendingEmail) setEmail(pendingEmail);
      if (!token) {
        setState("pending");
        setMessage("Check your inbox for the verification link. You need to verify your email before entering Rive.");
        return;
      }

      void fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          setState("error");
          setMessage(data.message || "This verification link is no longer valid.");
          return;
        }
        setState("success");
        setDestination(data.destination || "/onboarding");
        setMessage(data.message || "Email verified. Your workspace is ready.");
      }).catch(() => {
        setState("error");
        setMessage("We could not reach Rive. Try the link again in a moment.");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const resendHref = email ? `/register?email=${encodeURIComponent(email)}` : "/register";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="absolute right-3 top-3 z-50 sm:right-6 sm:top-6"><ThemeToggle /></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2eaf4_1px,transparent_1px),linear-gradient(to_bottom,#e2eaf4_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-50 dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)]" />
      <div className="z-10 w-full max-w-md text-center">
        <Link href="/" className="mb-8 inline-flex"><RiveLogo className="h-8 w-auto text-slate-900 dark:text-white" /></Link>
        <div className="rounded-2xl border border-border bg-white/85 p-8 shadow-[0_8px_30px_rgb(12,30,54,0.05)] dark:border-slate-800 dark:bg-slate-900/90">
          <div className={`mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl ${state === "error" ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300" : state === "success" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300"}`}>
            {state === "checking" ? <Loader2 className="h-7 w-7 animate-spin" /> : state === "error" ? <AlertCircle className="h-7 w-7" /> : state === "success" ? <CheckCircle2 className="h-7 w-7" /> : <MailCheck className="h-7 w-7" />}
          </div>
          <h1 className="text-xl font-bold text-foreground dark:text-white">{state === "checking" ? "Checking your link" : state === "success" ? "Email verified" : state === "error" ? "Verification needs attention" : "Check your email"}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground dark:text-slate-400">{state === "checking" ? "Just a moment..." : message}</p>
          {state === "success" && <Button type="button" onClick={() => window.location.replace(destination)} className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-blue-700">Open my workspace</Button>}
          {state === "error" && <Link href={resendHref} className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-blue-700">Request a new link</Link>}
          {state === "pending" && <Link href="/register" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-blue-700">Back to registration</Link>}
        </div>
      </div>
    </div>
  );
}
