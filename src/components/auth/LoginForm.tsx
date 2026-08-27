"use client";

import { Alert, FormField, Input } from "@/components/ui";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import PasswordInput from "@/components/PasswordInput";
import { resolveLoginDestination } from "@/utils/safeNextPath";
import { authFieldClassName, authQuietButtonClassName, authSubmitClassName } from "@/components/auth/authClasses";

export function LoginForm({
  initialEmail = "",
  nextPath = "",
  onSuccess,
  onForgot,
  onRegister,
}: {
  initialEmail?: string;
  nextPath?: string;
  onSuccess: (destination: string) => void;
  onForgot: () => void;
  onRegister: (email: string) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password || loading) return;

    setLoading(true);
    setError("");
    setNotice("");
    setVerificationRequired(false);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (data.success) {
        onSuccess(resolveLoginDestination(data.destination, nextPath));
        return;
      }

      if (data.code === "EMAIL_NOT_VERIFIED") {
        setVerificationRequired(true);
        return;
      }

      setError(data.message || "Invalid email or password.");
    } catch {
      setError("Connection error. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!email || resending) return;
    setResending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      setNotice(data.message || "If the account needs verification, a fresh link is on its way.");
    } catch {
      setError("We could not resend the link. Please try again.");
    } finally {
      setResending(false);
    }
  };

  if (verificationRequired) {
    return (
      <>
        <BaseDialog.Title className="pr-10 text-[1.65rem] font-black tracking-[-0.04em] text-foreground">
          Verify your email to continue
        </BaseDialog.Title>
        <BaseDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
          We sent a link to <span className="font-medium text-foreground">{email}</span>. Open it, then sign in.
        </BaseDialog.Description>
        {notice ? (
          <Alert variant="success" className="mb-5 mt-6 text-sm" data-testid="login-notice">
            {notice}
          </Alert>
        ) : null}
        {error ? (
          <Alert ref={alertRef} variant="destructive" tabIndex={-1} className="mb-5 mt-6 text-sm outline-none">
            {error}
          </Alert>
        ) : null}
        <button
          type="button"
          className={`${authSubmitClassName} mt-6`}
          disabled={resending}
          onClick={() => void resendVerification()}
        >
          {resending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending
            </>
          ) : (
            "Resend verification"
          )}
        </button>
        <button
          type="button"
          className={`${authQuietButtonClassName} mt-4`}
          onClick={() => {
            setVerificationRequired(false);
            setNotice("");
            setError("");
            setPassword("");
          }}
        >
          Use a different email
        </button>
      </>
    );
  }

  return (
    <>
      <BaseDialog.Title className="text-[1.65rem] font-black tracking-[-0.04em] text-foreground">
        Your context is still here.
      </BaseDialog.Title>
      <BaseDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
        Sign in to pick it up.
      </BaseDialog.Description>

      <form method="post" onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" aria-busy={loading} data-testid="login-form" data-hydrated={hydrated ? "true" : "false"}>
        {error ? (
          <Alert ref={alertRef} variant="destructive" tabIndex={-1} className="text-sm outline-none" data-testid="login-alert">
            {error}
          </Alert>
        ) : null}

        <FormField label="Email address" htmlFor="login-email">
          <Input
            id="login-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
            disabled={loading}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            autoFocus={!initialEmail}
            className={authFieldClassName}
          />
        </FormField>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="login-password" className="text-xs font-bold text-muted-foreground">
              Password
            </label>
            <button type="button" className="text-xs font-medium text-primary hover:text-primary/80" onClick={onForgot}>
              Forgot password?
            </button>
          </div>
          <PasswordInput
            id="login-password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={loading}
            autoComplete="current-password"
            autoFocus={Boolean(initialEmail)}
            className={authFieldClassName}
            toggleClassName="text-muted-foreground hover:text-foreground focus-visible:ring-primary/40"
          />
        </div>

        <button type="submit" className={authSubmitClassName} disabled={loading} aria-busy={loading} data-testid="login-submit">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Signing in
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-8 text-sm text-muted-foreground">
        New here?{" "}
        <button type="button" className={authQuietButtonClassName} onClick={() => onRegister(email)}>
          Create a workspace
        </button>
      </p>
    </>
  );
}
