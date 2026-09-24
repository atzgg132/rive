"use client";

import { Alert, FormField, Input } from "@/components/ui";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { authFieldClassName, authQuietButtonClassName, authSubmitClassName } from "@/components/auth/authClasses";
import { resolveLoginDestination } from "@/utils/safeNextPath";

export default function TwoFactorLoginPage() {
  const [nextPath, setNextPath] = useState("");
  const [code, setCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNextPath(new URLSearchParams(window.location.search).get("next") || "");
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!code || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/two-factor/verify", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.success) {
        window.location.assign(resolveLoginDestination(data.destination, nextPath));
        return;
      }
      if (data.code === "CHALLENGE_EXPIRED") {
        setExpired(true);
        return;
      }
      setError(data.message || "That code did not work. Please try again.");
    } catch {
      setError("Connection error. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (expired) {
    return (
      <>
        <AuthHeading title="This sign-in has expired" description="For your security, the code step has a short time limit." />
        <Link href="/login" className={authSubmitClassName}>
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Enter your code"
        description={
          useRecoveryCode
            ? "Enter one of the 10-character recovery codes you saved when you turned on two-factor authentication."
            : "Open your authenticator app and enter the 6-digit code for your rive. account."
        }
      />
      <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-5" aria-busy={loading} data-testid="two-factor-form">
        {error ? <Alert variant="destructive" className="text-sm" data-testid="two-factor-alert">{error}</Alert> : null}
        <FormField label={useRecoveryCode ? "Recovery code" : "Authenticator code"} htmlFor="two-factor-code">
          <Input
            id="two-factor-code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={useRecoveryCode ? "XXXX-XXXX" : "123456"}
            required
            disabled={loading}
            autoComplete="one-time-code"
            autoFocus
            inputMode={useRecoveryCode ? "text" : "numeric"}
            maxLength={useRecoveryCode ? 12 : 6}
            className={authFieldClassName}
            data-testid="two-factor-input"
          />
        </FormField>
        <button type="submit" className={authSubmitClassName} disabled={loading} aria-busy={loading} data-testid="two-factor-submit">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Verifying
            </>
          ) : (
            "Continue"
          )}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        <button
          type="button"
          className={authQuietButtonClassName}
          onClick={() => {
            setUseRecoveryCode((current) => !current);
            setCode("");
            setError("");
          }}
        >
          {useRecoveryCode ? "Use an authenticator code instead" : "Use a recovery code instead"}
        </button>
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        <Link href="/login" className={authQuietButtonClassName}>
          Back to sign in
        </Link>
      </p>
    </>
  );
}
