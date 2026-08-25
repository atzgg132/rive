"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import type { AuthParams, AuthView } from "@/components/auth/authIntent";

export function AuthOverlay({
  view,
  params,
  startPending,
  busy,
  onOpenChange,
  onSuccess,
  onViewChange,
}: {
  view: AuthView | null;
  params: AuthParams;
  startPending: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (destination: string) => void;
  onViewChange: (view: AuthView, patch?: Partial<AuthParams>) => void;
}) {
  const open = Boolean(view);

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (busy) return;
        onOpenChange(nextOpen);
      }}
      disablePointerDismissal={busy}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop
          className="auth-overlay-backdrop fixed inset-0 z-[80] min-h-dvh bg-black/55 backdrop-blur-md"
          data-surface="auth-overlay"
        />
        <BaseDialog.Viewport className="fixed inset-0 z-[80] flex min-h-dvh items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
          <BaseDialog.Popup
            data-surface="auth-overlay"
            className="auth-overlay-panel relative w-full max-w-[26.5rem] max-h-[90dvh] overflow-y-auto rounded-t-[1.6rem] border border-white/10 bg-[#0a0e16]/92 p-6 pb-10 text-slate-100 shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:max-h-[min(100dvh-3rem,_42rem)] sm:rounded-[1.6rem] sm:p-8 sm:pb-8"
          >
            <BaseDialog.Close
              disabled={busy}
              className="absolute right-3 top-3 inline-flex h-9 w-9 appearance-none items-center justify-center rounded-lg border-0 bg-transparent text-slate-400 shadow-none transition-colors duration-150 ease-rive-out hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </BaseDialog.Close>
            <div key={view} className="auth-overlay-view">
              {view === "login" ? (
                <LoginForm
                  key={`login-${params.email}-${params.next}`}
                  initialEmail={params.email}
                  nextPath={params.next}
                  onSuccess={onSuccess}
                  onForgot={() => onViewChange("forgot")}
                  onRegister={(email) => onViewChange("register", { email })}
                />
              ) : null}
              {view === "register" ? (
                <RegisterForm
                  key={`register-${params.email}-${params.invite}-${startPending ? "pending" : "form"}`}
                  initialEmail={params.email}
                  inviteToken={params.invite}
                  startPending={startPending}
                  onLogin={(email) => onViewChange("login", { email })}
                />
              ) : null}
              {view === "forgot" ? (
                <ForgotPasswordForm
                  key={`forgot-${params.email}`}
                  initialEmail={params.email}
                  onLogin={() => onViewChange("login")}
                />
              ) : null}
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export function AuthEnterVeil({ visible }: { visible: boolean }) {
  return (
    <div
      className="auth-enter-veil fixed inset-0 z-[90] bg-[#05070c]"
      data-visible={visible ? "true" : "false"}
      aria-hidden="true"
    />
  );
}
