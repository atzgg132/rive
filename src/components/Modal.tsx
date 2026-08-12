"use client";

import { Button, Input } from "@/components/ui";

import { X, CheckCircle2, Loader2, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { submitToWaitlist } from "@/utils/api";

type ModalType = "login" | "waitlist";
type FormState = "idle" | "loading" | "success" | "already-joined";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ModalType;
}

function WaitlistForm({
  onClose,
  heading,
  subtext,
  ctaLabel,
  ctaClass,
  submitType,
}: {
  onClose: () => void;
  heading: string;
  subtext: string;
  ctaLabel: string;
  ctaClass: string;
  submitType: "waitlist" | "login";
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || state === "loading") return;
    setState("loading");
    const res = await submitToWaitlist(email, submitType);
    setEmailSent(res.emailSent);
    if (res.alreadyJoined) {
      setState("already-joined");
    } else if (res.success) {
      setState("success");
    } else {
      setState("idle");
    }
  };

  // Auto-close after showing success/already-joined
  useEffect(() => {
    if (state === "success" || state === "already-joined") {
      const t = setTimeout(() => {
        onClose();
        setTimeout(() => {
          setState("idle");
          setEmail("");
        }, 400);
      }, 3200);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  return (
    <div className="relative overflow-hidden min-h-[260px] flex flex-col">
      {/* ── Idle / loading form ── */}
      <div
        className="flex flex-col gap-5 transition-all duration-500"
        style={{
          opacity: state === "idle" || state === "loading" ? 1 : 0,
          transform:
            state === "idle" || state === "loading"
              ? "translateY(0)"
              : "translateY(-24px)",
          pointerEvents: state === "idle" || state === "loading" ? "auto" : "none",
          position: "relative",
        }}
      >
        <div className="text-center">
          <h3
            className="text-2xl font-bold text-slate-800 dark:text-white mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {heading}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
            {subtext}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={state === "loading"}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-all duration-200 disabled:opacity-60"
          />
          <Button
            type="submit"
            disabled={state === "loading"}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${ctaClass} disabled:opacity-75`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {state === "loading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              ctaLabel
            )}
          </Button>
        </form>
      </div>

      {/* ── Success state ── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center transition-all duration-500"
        style={{
          opacity: state === "success" ? 1 : 0,
          transform: state === "success" ? "translateY(0) scale(1)" : "translateY(24px) scale(0.96)",
          pointerEvents: state === "success" ? "auto" : "none",
        }}
      >
        {/* Animated ring */}
        <div className="relative flex items-center justify-center">
          <span className="absolute w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-950/40 animate-ping opacity-30" />
          <CheckCircle2 className="w-16 h-16 text-emerald-500 dark:text-emerald-400 relative z-10" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1" style={{ fontFamily: "var(--font-display)" }}>
            You&apos;re on the list!
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm" style={{ fontFamily: "var(--font-body)" }}>
            We&apos;ll reach out as soon as your spot is ready.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            {emailSent ? `Confirmation sent to ${email}` : `Spot saved for ${email}`}
          </div>
        </div>
      </div>

      {/* ── Already joined state ── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center transition-all duration-500"
        style={{
          opacity: state === "already-joined" ? 1 : 0,
          transform: state === "already-joined" ? "translateY(0) scale(1)" : "translateY(24px) scale(0.96)",
          pointerEvents: state === "already-joined" ? "auto" : "none",
        }}
      >
        <div className="relative flex items-center justify-center">
          <span className="absolute w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-950/40 animate-ping opacity-20" />
          <Clock className="w-16 h-16 text-blue-500 dark:text-blue-400 relative z-10" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1" style={{ fontFamily: "var(--font-display)" }}>
            You&apos;re already on the list
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm" style={{ fontFamily: "var(--font-body)" }}>
            You&apos;re already registered with this email.
            <br />
            We&apos;ll notify you when your access is ready.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
            {email}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Modal({ isOpen, onClose, type }: ModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay so mount → animate-in
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ transition: "opacity 300ms", opacity: visible ? 1 : 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0C1E36]/30 dark:bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
        style={{ transition: "opacity 300ms" }}
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={type === "login" ? "Developer access" : "Join the waitlist"}
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl shadow-slate-200/80 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-8"
        style={{
          transition: "transform 350ms cubic-bezier(.16,1,.3,1), opacity 300ms",
          transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)",
          opacity: visible ? 1 : 0,
        }}
      >
        {/* Close */}
        <Button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </Button>

        {/* ── Waitlist ── */}
        {type === "waitlist" && (
          <WaitlistForm
            onClose={onClose}
            heading="Join the waitlist"
            subtext="We’re opening access in small groups. Leave your email and we’ll let you know as soon as your workspace is ready."
            ctaLabel="Request an invitation"
            ctaClass="bg-gradient-to-r from-blue-600 to-sky-500 text-white hover:from-blue-700 hover:to-sky-600 shadow-md shadow-blue-600/10"
            submitType="waitlist"
          />
        )}

        {/* ── Login ── */}
        {type === "login" && (
          <WaitlistForm
            onClose={onClose}
            heading="Developer portal"
            subtext="Enter your invited email to request access to the current release."
            ctaLabel="Request access"
            ctaClass="bg-slate-800 text-white hover:bg-slate-900 shadow-md"
            submitType="login"
          />
        )}

      </div>
    </div>
  );
}
