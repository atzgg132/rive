"use client";

import { X, CheckCircle2, Play, Loader2, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { submitToWaitlist } from "@/utils/api";

type ModalType = "login" | "waitlist" | "demo";
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
  submitType: "waitlist" | "login" | "demo";
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || state === "loading") return;
    setState("loading");
    const res = await submitToWaitlist(email, submitType);
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
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={state === "loading"}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-all duration-200 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={state === "loading"}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${ctaClass} disabled:opacity-75`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {state === "loading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>checking...</span>
              </>
            ) : (
              ctaLabel
            )}
          </button>
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
            you&apos;re on the list!
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm" style={{ fontFamily: "var(--font-body)" }}>
            we&apos;ll reach out as soon as your spot is ready.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            confirmation sent to {email}
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
            already on the list
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm" style={{ fontFamily: "var(--font-body)" }}>
            you&apos;re already registered with this email.
            <br />
            sit tight — we&apos;ll notify you when your batch opens.
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
  const [demoPlayed, setDemoPlayed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay so mount → animate-in
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      setDemoPlayed(false);
    }
  }, [isOpen]);

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
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-2xl shadow-slate-200/80 dark:shadow-none z-10 transition-colors"
        style={{
          transition: "transform 350ms cubic-bezier(.16,1,.3,1), opacity 300ms",
          transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)",
          opacity: visible ? 1 : 0,
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ── Waitlist ── */}
        {type === "waitlist" && (
          <WaitlistForm
            onClose={onClose}
            heading="join the waitlist"
            subtext="we're in closed alpha. drop your email to secure early access in our next batch release."
            ctaLabel="request invitation"
            ctaClass="bg-gradient-to-r from-blue-600 to-sky-500 text-white hover:from-blue-700 hover:to-sky-600 shadow-md shadow-blue-600/10"
            submitType="waitlist"
          />
        )}

        {/* ── Login ── */}
        {type === "login" && (
          <WaitlistForm
            onClose={onClose}
            heading="developer portal"
            subtext="no general access yet. enter your invited email to join the alpha waitlist."
            ctaLabel="register for alpha access"
            ctaClass="bg-slate-800 text-white hover:bg-slate-900 shadow-md"
            submitType="login"
          />
        )}

        {/* ── Demo ── */}
        {type === "demo" && (
          <div className="flex flex-col gap-5 text-center">
            <div>
              <h3
                className="text-2xl font-bold text-slate-800 mb-1"
                style={{ fontFamily: "var(--font-display)" }}
              >
                rive. product preview
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm" style={{ fontFamily: "var(--font-body)" }}>
                watch how our native ai handles invoicing and client management.
              </p>
            </div>

            <div className="relative aspect-video w-full rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50 border border-slate-200 flex items-center justify-center overflow-hidden group">
              <button
                onClick={() => setDemoPlayed(true)}
                className="relative z-10 w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform duration-200"
                style={{ opacity: demoPlayed ? 0 : 1, transition: "opacity 300ms" }}
              >
                <Play className="w-6 h-6 fill-current ml-1" />
              </button>

              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95 dark:bg-slate-900/95 px-6"
                style={{
                  opacity: demoPlayed ? 1 : 0,
                  transform: demoPlayed ? "scale(1)" : "scale(0.96)",
                  transition: "opacity 400ms, transform 400ms cubic-bezier(.16,1,.3,1)",
                }}
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                <p
                  className="text-slate-700 text-sm font-bold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  your workspace is ready to organize
                </p>
                <p className="text-slate-400 text-xs" style={{ fontFamily: "var(--font-body)" }}>
                  manage clients, projects, invoices, and expenses from one calm dashboard.
                </p>
                <button
                  onClick={() => {
                    setDemoPlayed(false);
                    onClose();
                    setTimeout(() =>
                      window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" })),
                      350
                    );
                  }}
                  className="mt-1 px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  join waitlist →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
