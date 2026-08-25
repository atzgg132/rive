"use client";

import { Alert, FormField, Input } from "@/components/ui";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { FormEvent, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import PasswordInput from "@/components/PasswordInput";
import { authFieldClassName, authQuietButtonClassName, authSubmitClassName } from "@/components/auth/authClasses";
import HoneypotField, { usePublicFormOpenedAt } from "@/components/HoneypotField";

export function RegisterForm({
  initialEmail = "",
  inviteToken = "",
  startPending = false,
  onLogin,
}: {
  initialEmail?: string;
  inviteToken?: string;
  startPending?: boolean;
  onLogin: (email: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [pendingEmail, setPendingEmail] = useState(startPending ? initialEmail : "");
  const [notice, setNotice] = useState("");
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const { startedAtRef, websiteRef } = usePublicFormOpenedAt();

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password || !name || loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          inviteToken: inviteToken || undefined,
          website: websiteRef.current?.value ?? "",
          startedAt: startedAtRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.message || "Unable to create your account. Please try again.");
        return;
      }
      setPendingEmail(email.trim().toLowerCase());
      setPassword("");
      setNotice("Your account is ready. Check your inbox for the verification link.");
    } catch {
      setError("Connection error. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!pendingEmail || resending) return;
    setResending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const data = await response.json().catch(() => ({}));
      setNotice(data.message || "If the account needs verification, a fresh link is on its way.");
    } catch {
      setError("We could not resend the link. Please try again.");
    } finally {
      setResending(false);
    }
  };

  if (pendingEmail) {
    return (
      <>
        <BaseDialog.Title className="pr-10 text-[1.65rem] font-black tracking-[-0.04em] text-foreground">
          Check your email
        </BaseDialog.Title>
        <BaseDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
          We sent a verification link to <span className="font-medium text-foreground">{pendingEmail}</span>. Verify it to open your workspace.
        </BaseDialog.Description>
        {notice ? <Alert variant="success" className="mb-5 mt-6 text-sm">{notice}</Alert> : null}
        {error ? <Alert variant="destructive" className="mb-5 mt-6 text-sm">{error}</Alert> : null}
        <button type="button" className={`${authSubmitClassName} mt-6`} onClick={() => void resend()} disabled={resending}>
          {resending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending fresh link...
            </>
          ) : (
            "Resend verification email"
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setPendingEmail("");
            setNotice("");
            setError("");
          }}
          className={`${authQuietButtonClassName} mt-4`}
        >
          Use a different email
        </button>
      </>
    );
  }

  return (
    <>
      <BaseDialog.Title className="text-[1.65rem] font-black tracking-[-0.04em] text-foreground">
        Create your Rive workspace
      </BaseDialog.Title>
      <BaseDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
        Free access during open beta. Start with the work that feels messiest today.
      </BaseDialog.Description>
      <form method="post" onSubmit={handleRegister} className="mt-8 flex flex-col gap-5" data-testid="register-form" data-hydrated={hydrated ? "true" : "false"} data-invite={inviteToken || undefined}>
        <HoneypotField inputRef={websiteRef} />
        {error ? <Alert variant="destructive" className="text-sm">{error}</Alert> : null}
        <FormField label="Full name" htmlFor="register-name">
          <Input
            id="register-name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jane Doe"
            required
            disabled={loading}
            autoComplete="name"
            className={authFieldClassName}
          />
        </FormField>
        <FormField label="Email address" htmlFor="register-email">
          <Input
            id="register-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
            disabled={loading}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            className={authFieldClassName}
          />
        </FormField>
        <FormField label="Password" htmlFor="register-password" hint="Use at least 8 characters.">
          <PasswordInput
            id="register-password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={loading}
            autoComplete="new-password"
            minLength={8}
            className={authFieldClassName}
            toggleClassName="text-muted-foreground hover:text-foreground focus-visible:ring-primary/40"
          />
        </FormField>
        <p className="text-xs leading-5 text-muted-foreground">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="font-medium text-foreground hover:text-primary hover:underline">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="font-medium text-foreground hover:text-primary hover:underline">Privacy Policy</Link>.
        </p>
        <button type="submit" className={authSubmitClassName} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Creating workspace...
            </>
          ) : (
            "Create Account"
          )}
        </button>
      </form>
      <p className="mt-8 text-sm text-muted-foreground">
        Already have an account?{" "}
        <button type="button" className={authQuietButtonClassName} onClick={() => onLogin(email)}>
          Log in
        </button>
      </p>
    </>
  );
}
