"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Shield } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import RiveLogo from "@/components/RiveLogo";
import PasswordInput from "@/components/PasswordInput";
import { fetchAdmin } from "./shared";

export function Login({ onLogin, notice = "", totpRequired = false }: { onLogin: () => void; notice?: string; totpRequired?: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeRequired, setCodeRequired] = useState(totpRequired);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetchAdmin("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, ...(code.trim() ? { code: code.trim() } : {}) }), credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (data?.code === "totp_required") {
        // The session check should have advertised this already, but a client
        // that skipped it still lands here — reveal the field and let the
        // operator complete the second factor.
        setCodeRequired(true);
        setError("");
        return;
      }
      if (!response.ok || !data?.success) throw new Error(data?.message || "Invalid credentials.");
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-background px-5 py-8"><div className="w-full max-w-sm"><div className="mb-8 flex justify-center"><RiveLogo height={38} /></div><form onSubmit={submit} className="rounded-none border border-border bg-card p-8"><div className="mb-7 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-none bg-primary/10 text-primary"><Shield className="h-6 w-6" /></div><h1 className="text-2xl font-bold text-card-foreground">Admin workspace</h1><p className="mt-1 text-sm text-muted-foreground">Product operations and funnel quality</p></div>{notice && !error ? <p className="mb-4 rounded-none border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning" role="status" data-testid="admin-session-notice">{notice}</p> : null}<label className="mb-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Username<Input value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" autoFocus className="mt-2" /></label><label className="mb-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password<PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="mt-2" /></label>{codeRequired ? <label className="mb-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Authenticator code<Input value={code} onChange={(event) => setCode(event.target.value)} required inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="mt-2" /></label> : null}{error ? <p className="mb-4 rounded-none border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert" data-testid="admin-login-error">{error}</p> : null}<Button type="submit" variant="default" size="lg" disabled={loading} className="w-full">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}{loading ? "Signing in…" : "Sign in securely"}</Button><p className="mt-5 text-center text-xs text-muted-foreground">Protected by an HttpOnly session cookie.</p></form><div className="mt-4 flex justify-end"><ThemeToggle /></div></div></main>;
}
