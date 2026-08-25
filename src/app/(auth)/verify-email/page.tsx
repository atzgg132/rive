"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { useAuthOverlay } from "@/components/auth/AuthOverlayProvider";
import { authSubmitClassName } from "@/components/auth/authClasses";

type State = "checking" | "pending" | "success" | "error";

export default function VerifyEmailPage() {
  const { enterWorkspace } = useAuthOverlay();
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
  const title =
    state === "checking" ? "Checking your link"
      : state === "success" ? "Email verified"
        : state === "error" ? "Verification needs attention"
          : "Check your email";

  return (
    <>
      <AuthHeading
        title={title}
        description={state === "checking" ? "Just a moment..." : message}
      />
      {state === "checking" ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : null}
      {state === "success" ? (
        <button type="button" className={authSubmitClassName} onClick={() => enterWorkspace(destination)}>
          Open my workspace
        </button>
      ) : null}
      {state === "error" ? (
        <Link href={resendHref} className={authSubmitClassName}>
          Request a new link
        </Link>
      ) : null}
      {state === "pending" ? (
        <Link href="/register" className={authSubmitClassName}>
          Back to registration
        </Link>
      ) : null}
    </>
  );
}
