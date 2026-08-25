"use client";

import { Alert, FormField, Input } from "@/components/ui";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { authFieldClassName, authQuietButtonClassName, authSubmitClassName } from "@/components/auth/authClasses";
import HoneypotField, { usePublicFormOpenedAt } from "@/components/HoneypotField";

export function ForgotPasswordForm({
  initialEmail = "",
  onLogin,
}: {
  initialEmail?: string;
  onLogin: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { startedAtRef, websiteRef } = usePublicFormOpenedAt();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          website: websiteRef.current?.value ?? "",
          startedAt: startedAtRef.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.message || "Please check the email address and try again.");
      else setMessage(data.message);
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <BaseDialog.Title className="pr-10 text-[1.65rem] font-black tracking-[-0.04em] text-foreground">
        Reset your password
      </BaseDialog.Title>
      <BaseDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
        Enter the email on your account. We will send a secure, one-time link that expires in 60 minutes.
      </BaseDialog.Description>
      {message ? (
        <Alert variant="success" className="mt-8 text-sm">
          <p>{message}</p>
          <p className="mt-2 text-xs">Check spam if it does not arrive within a few minutes.</p>
        </Alert>
      ) : (
        <form method="post" onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <HoneypotField inputRef={websiteRef} />
          {error ? <Alert variant="destructive" className="text-sm">{error}</Alert> : null}
          <FormField label="Email address" htmlFor="forgot-email">
            <Input
              id="forgot-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              className={authFieldClassName}
            />
          </FormField>
          <button type="submit" className={authSubmitClassName} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending
              </>
            ) : (
              "Send secure reset link"
            )}
          </button>
        </form>
      )}
      <button type="button" className={`${authQuietButtonClassName} mt-8`} onClick={onLogin}>
        Back to login
      </button>
    </>
  );
}
