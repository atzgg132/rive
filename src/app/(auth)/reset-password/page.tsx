"use client";

import { Alert, FormField } from "@/components/ui";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import PasswordInput from "@/components/PasswordInput";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { authFieldClassName, authSubmitClassName } from "@/components/auth/authClasses";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 8) return setError("Use at least 8 characters.");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.message || "This reset link could not be used.");
      else setSuccess(true);
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <>
        <AuthHeading title="Password updated" description="Your new password is active. You can sign in now." />
        <Link href="/login" className={authSubmitClassName}>
          Continue to login
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Choose a new password"
        description="Make it memorable, unique, and at least 8 characters long."
      />
      {!token ? (
        <Alert variant="warning" className="text-sm">
          This page needs a valid reset link.{" "}
          <Link href="/forgot-password" className="font-medium underline">Request a new one.</Link>
        </Alert>
      ) : (
        <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error ? <Alert variant="destructive" className="text-sm">{error}</Alert> : null}
          <FormField label="New password" htmlFor="reset-password">
            <PasswordInput
              id="reset-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={authFieldClassName}
              toggleClassName="text-muted-foreground hover:text-foreground focus-visible:ring-primary/40"
            />
          </FormField>
          <FormField label="Confirm password" htmlFor="reset-password-confirm">
            <PasswordInput
              id="reset-password-confirm"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={authFieldClassName}
              toggleClassName="text-muted-foreground hover:text-foreground focus-visible:ring-primary/40"
            />
          </FormField>
          <button type="submit" className={authSubmitClassName} disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : "Update password"}
          </button>
        </form>
      )}
    </>
  );
}
