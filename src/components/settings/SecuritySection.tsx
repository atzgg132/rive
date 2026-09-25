"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Input } from "@/components/ui";
import { TwoFactorSettings } from "@/components/settings/TwoFactorSettings";

export function SecuritySection({ isGoogleOnlyAccount }: { isGoogleOnlyAccount: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) { toast.error("Use at least 8 characters for your new password."); return; }
    setSavingPassword(true);
    try {
      const response = await fetch("/api/settings/security/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Password could not be changed.");
      toast.success(payload.message || "Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password could not be changed.");
    } finally {
      setSavingPassword(false);
    }
  };

  const signOutAll = async () => {
    if (!window.confirm("Sign out of every other device? This one stays signed in.")) return;
    setSigningOut(true);
    try {
      const response = await fetch("/api/settings/security/sign-out-all", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Could not sign out other devices.");
      toast.success(payload.message || "Signed out of all other devices.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out other devices.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <section id="security" className="scroll-mt-24 rounded-none border border-border bg-card p-5">
      <h2 className="font-semibold">Security</h2>
      <p className="mt-1 text-xs text-muted-foreground">{isGoogleOnlyAccount ? "This account signs in with Google. Set a password to also sign in directly." : "Change your password or sign out of other devices."}</p>
      <form onSubmit={changePassword} className="mt-5 space-y-4 border-b border-border pb-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {!isGoogleOnlyAccount ? (
            <label className="text-xs font-semibold text-muted-foreground">Current password<Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-2" required /></label>
          ) : null}
          <label className="text-xs font-semibold text-muted-foreground">{isGoogleOnlyAccount ? "New password" : "New password"}<Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} className="mt-2" required /></label>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={savingPassword}>{savingPassword ? "Saving…" : isGoogleOnlyAccount ? "Set password" : "Change password"}</Button>
        </div>
      </form>
      <div className="border-b border-border py-5">
        <TwoFactorSettings />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Sign out of all other devices</p>
          <p className="text-xs text-muted-foreground">Ends every other session. This device stays signed in.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void signOutAll()} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out everywhere else"}</Button>
      </div>
    </section>
  );
}
