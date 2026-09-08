"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { authViewFromPathname, type AuthParams, type AuthView } from "@/components/auth/authIntent";
import { RiveLogo } from "@/components/RiveLogo";

const routeCopy = {
  register: { kicker: "Open beta", title: "Create your workspace.", body: "Add a client, start a project, and put Rive to work on real work." },
  login: { kicker: "Welcome back", title: "The work is where you left it.", body: "Log in to return to your clients, projects, agreements, and invoices." },
  forgot: { kicker: "Account recovery", title: "Find your way back in.", body: "Request a secure reset link and continue where you left off." },
} as const;

export function AuthOverlay({ view, params, startPending, busy, onOpenChange, onSuccess, onViewChange }: { view: AuthView | null; params: AuthParams; startPending: boolean; busy: boolean; onOpenChange: (open: boolean) => void; onSuccess: (destination: string) => void; onViewChange: (view: AuthView, patch?: Partial<AuthParams>) => void }) {
  const pathname = usePathname();
  const dedicated = Boolean(authViewFromPathname(pathname));
  const copy = view ? routeCopy[view] : routeCopy.register;
  return (
    <BaseDialog.Root open={Boolean(view)} onOpenChange={(nextOpen) => { if (!busy) onOpenChange(nextOpen); }} disablePointerDismissal={busy}>
      <BaseDialog.Portal keepMounted>
        <BaseDialog.Backdrop className={`auth-overlay-backdrop fixed inset-0 z-[80] min-h-dvh ${dedicated ? "edition-auth-backdrop" : "bg-[var(--auth-scrim)] backdrop-blur-md"}`} />
        <BaseDialog.Viewport className={`fixed inset-0 z-[80] flex ${dedicated ? "edition-auth-viewport overflow-hidden" : "min-h-dvh overflow-y-auto items-end justify-center p-0 sm:items-center sm:p-6"}`}>
          <BaseDialog.Popup data-surface="marketing" className={dedicated ? "auth-overlay-panel edition-auth-panel" : "auth-overlay-panel relative w-full max-w-[26.5rem] max-h-[90dvh] overflow-y-auto rounded-t-none border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] p-6 pb-10 text-foreground shadow-overlay sm:max-h-[min(100dvh-3rem,_42rem)] sm:rounded-none sm:p-8"}>
            {dedicated ? (
              <div className="edition-auth-art">
                <div><RiveLogo height={28} /><span>{copy.kicker}</span></div>
                <div className="edition-auth-art__lead"><p>{copy.title}</p><span>{copy.body}</span></div>
                <p className="edition-auth-art__note">Free during open beta.</p>
              </div>
            ) : (
              <BaseDialog.Close disabled={busy} className="marketing-focus edition-auth-close" aria-label="Close"><X className="h-4 w-4" /></BaseDialog.Close>
            )}
            <div className={dedicated ? "edition-auth-form" : "auth-overlay-view"} key={view}>
              {view === "login" ? <LoginForm key={`login-${params.email}-${params.next}`} initialEmail={params.email} nextPath={params.next} onSuccess={onSuccess} onForgot={() => onViewChange("forgot")} onRegister={(email) => onViewChange("register", { email })} /> : null}
              {view === "register" ? <RegisterForm key={`register-${params.email}-${params.invite}-${startPending ? "pending" : "form"}`} initialEmail={params.email} inviteToken={params.invite} startPending={startPending} nextPath={params.next} goal={params.goal} onLogin={(email) => onViewChange("login", { email })} /> : null}
              {view === "forgot" ? <ForgotPasswordForm key={`forgot-${params.email}`} initialEmail={params.email} onLogin={() => onViewChange("login")} /> : null}
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export function AuthEnterVeil({ visible }: { visible: boolean }) {
  return <div className="auth-enter-veil fixed inset-0 z-[90] bg-[rgb(var(--background))]" data-visible={visible ? "true" : "false"} aria-hidden="true" />;
}
