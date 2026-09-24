"use client";

// Self-contained two-factor authentication settings card. Deliberately takes
// no required props: PR 1 (feature/settings-page) owns /settings and its
// Security section and will mount this component there once it lands. Until
// then it is unmounted anywhere in the app — see the PR body for this branch.
//
// It fetches and mutates its own state against /api/workflow/two-factor/*, so
// dropping it into any authenticated page works without wiring.

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from "@/components/ui";
import PasswordInput from "@/components/PasswordInput";

type Status = { enabled: boolean; enabledAt: string | null; remainingRecoveryCodes: number };

type Stage =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "idle" }
  | { kind: "enroll_start" }
  | { kind: "enroll_confirm"; otpauthUri: string; manualKey: string }
  | { kind: "recovery_codes"; codes: string[]; purpose: "enabled" | "regenerated" }
  | { kind: "disable" }
  | { kind: "regenerate" };

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

type StatusResult = { ok: true; status: Status } | { ok: false; message: string };

async function fetchStatus(): Promise<StatusResult> {
  try {
    const response = await fetch("/api/workflow/two-factor", { cache: "no-store" });
    const data = await readJson(response);
    if (!response.ok || !data.success) {
      return { ok: false, message: typeof data.message === "string" ? data.message : "Could not load two-factor status." };
    }
    return {
      ok: true,
      status: {
        enabled: Boolean(data.enabled),
        enabledAt: typeof data.enabledAt === "string" ? data.enabledAt : null,
        remainingRecoveryCodes: typeof data.remainingRecoveryCodes === "number" ? data.remainingRecoveryCodes : 0,
      },
    };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

export function TwoFactorSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const applyStatus = useCallback((result: StatusResult) => {
    if (!result.ok) {
      setStage({ kind: "error", message: result.message });
      return;
    }
    setStatus(result.status);
    setStage({ kind: "idle" });
  }, []);

  const loadStatus = useCallback(async () => applyStatus(await fetchStatus()), [applyStatus]);

  useEffect(() => {
    let cancelled = false;
    void fetchStatus().then((result) => {
      if (!cancelled) applyStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyStatus]);

  async function startEnroll() {
    setBusy(true);
    setFormError("");
    try {
      const response = await fetch("/api/workflow/two-factor/enroll/start", { method: "POST" });
      const data = await readJson(response);
      if (!response.ok || !data.success) {
        setFormError(typeof data.message === "string" ? data.message : "Could not start enrollment.");
        return;
      }
      setStage({ kind: "enroll_confirm", otpauthUri: String(data.otpauthUri || ""), manualKey: String(data.manualKey || "") });
    } catch {
      setFormError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll(code: string) {
    setBusy(true);
    setFormError("");
    try {
      const response = await fetch("/api/workflow/two-factor/enroll/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) {
        setFormError(typeof data.message === "string" ? data.message : "That code did not work.");
        return;
      }
      setStage({ kind: "recovery_codes", codes: Array.isArray(data.recoveryCodes) ? data.recoveryCodes.map(String) : [], purpose: "enabled" });
      await loadStatus();
    } catch {
      setFormError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(password: string, code: string) {
    setBusy(true);
    setFormError("");
    try {
      const response = await fetch("/api/workflow/two-factor/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined, code }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) {
        setFormError(typeof data.message === "string" ? data.message : "Could not turn off two-factor authentication.");
        return;
      }
      await loadStatus();
    } catch {
      setFormError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(password: string, code: string) {
    setBusy(true);
    setFormError("");
    try {
      const response = await fetch("/api/workflow/two-factor/regenerate-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined, code }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) {
        setFormError(typeof data.message === "string" ? data.message : "Could not regenerate recovery codes.");
        return;
      }
      setStage({ kind: "recovery_codes", codes: Array.isArray(data.recoveryCodes) ? data.recoveryCodes.map(String) : [], purpose: "regenerated" });
      await loadStatus();
    } catch {
      setFormError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (stage.kind === "loading" || !status) {
    return (
      <Card data-testid="two-factor-settings">
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </CardContent>
      </Card>
    );
  }

  if (stage.kind === "error") {
    return (
      <Card data-testid="two-factor-settings">
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="text-sm">{stage.message}</Alert>
          <Button variant="outline" className="mt-3" onClick={() => { setStage({ kind: "loading" }); void loadStatus(); }}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (stage.kind === "recovery_codes") {
    return <RecoveryCodesPanel codes={stage.codes} purpose={stage.purpose} onDone={() => setStage({ kind: "idle" })} />;
  }

  if (stage.kind === "enroll_confirm") {
    return (
      <EnrollConfirmPanel
        otpauthUri={stage.otpauthUri}
        manualKey={stage.manualKey}
        busy={busy}
        error={formError}
        onCancel={() => { setStage({ kind: "idle" }); setFormError(""); }}
        onConfirm={confirmEnroll}
      />
    );
  }

  if (stage.kind === "disable") {
    return (
      <ReauthPanel
        title="Turn off two-factor authentication"
        description="Confirm your password (if your account has one) and a current code to turn off two-factor authentication."
        confirmLabel="Turn off"
        busy={busy}
        error={formError}
        onCancel={() => { setStage({ kind: "idle" }); setFormError(""); }}
        onSubmit={disable}
      />
    );
  }

  if (stage.kind === "regenerate") {
    return (
      <ReauthPanel
        title="Regenerate recovery codes"
        description="Confirm your password (if your account has one) and a current code. Your old recovery codes stop working immediately."
        confirmLabel="Generate new codes"
        busy={busy}
        error={formError}
        onCancel={() => { setStage({ kind: "idle" }); setFormError(""); }}
        onSubmit={regenerate}
      />
    );
  }

  return (
    <Card data-testid="two-factor-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status.enabled ? <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> : <ShieldOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
          Two-factor authentication
        </CardTitle>
        <CardDescription>
          {status.enabled
            ? `On since ${status.enabledAt ? new Date(status.enabledAt).toLocaleDateString() : "—"}. ${status.remainingRecoveryCodes} unused recovery code${status.remainingRecoveryCodes === 1 ? "" : "s"} left.`
            : "Require an authenticator app code, in addition to your password, when signing in."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {status.enabled ? (
          <>
            <Button variant="outline" onClick={() => setStage({ kind: "regenerate" })} data-testid="two-factor-regenerate-button">
              Regenerate recovery codes
            </Button>
            <Button variant="destructive" onClick={() => setStage({ kind: "disable" })} data-testid="two-factor-disable-button">
              Turn off
            </Button>
          </>
        ) : (
          <Button onClick={() => void startEnroll()} disabled={busy} data-testid="two-factor-enable-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Turn on two-factor authentication"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function EnrollConfirmPanel({
  otpauthUri,
  manualKey,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  otpauthUri: string;
  manualKey: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  return (
    <Card data-testid="two-factor-settings">
      <CardHeader>
        <CardTitle>Set up your authenticator app</CardTitle>
        <CardDescription>
          Add this account in your authenticator app. Most apps accept the setup link directly; if yours needs a QR code
          instead, use the manual key below.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? <Alert variant="destructive" className="text-sm">{error}</Alert> : null}
        <div className="break-all rounded-none border border-border bg-muted/40 p-3 text-xs" data-testid="two-factor-otpauth-uri">
          {otpauthUri}
        </div>
        <FormField label="Manual entry key" htmlFor="two-factor-manual-key">
          <Input id="two-factor-manual-key" readOnly value={manualKey} data-testid="two-factor-manual-key" />
        </FormField>
        <FormField label="6-digit code" htmlFor="two-factor-confirm-code">
          <Input
            id="two-factor-confirm-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            data-testid="two-factor-confirm-input"
          />
        </FormField>
        <div className="flex gap-3">
          <Button onClick={() => onConfirm(code)} disabled={busy || code.length !== 6} data-testid="two-factor-confirm-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Confirm and turn on"}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReauthPanel({
  title,
  description,
  confirmLabel,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (password: string, code: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  return (
    <Card data-testid="two-factor-settings">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? <Alert variant="destructive" className="text-sm">{error}</Alert> : null}
        <FormField label="Current password (leave blank for Google-only accounts)" htmlFor="two-factor-reauth-password">
          <PasswordInput
            id="two-factor-reauth-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            data-testid="two-factor-reauth-password"
          />
        </FormField>
        <FormField label="Current authenticator or recovery code" htmlFor="two-factor-reauth-code">
          <Input
            id="two-factor-reauth-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456 or XXXX-XXXX"
            autoComplete="one-time-code"
            data-testid="two-factor-reauth-code"
          />
        </FormField>
        <div className="flex gap-3">
          <Button variant="destructive" onClick={() => onSubmit(password, code)} disabled={busy || !code} data-testid="two-factor-reauth-submit">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecoveryCodesPanel({
  codes,
  purpose,
  onDone,
}: {
  codes: string[];
  purpose: "enabled" | "regenerated";
  onDone: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Card data-testid="two-factor-settings">
      <CardHeader>
        <CardTitle>{purpose === "enabled" ? "Two-factor authentication is on" : "New recovery codes"}</CardTitle>
        <CardDescription>
          Save these 10 codes somewhere safe, such as a password manager. Each one signs you in exactly once if you
          lose access to your authenticator app. They will not be shown again.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul
          className="grid grid-cols-2 gap-2 rounded-none border border-border bg-muted/40 p-4 font-mono text-sm"
          data-testid="two-factor-recovery-codes"
        >
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            data-testid="two-factor-recovery-confirm-checkbox"
          />
          I&rsquo;ve saved these recovery codes.
        </label>
        <Button onClick={onDone} disabled={!confirmed} data-testid="two-factor-recovery-confirm-button">
          Done
        </Button>
      </CardContent>
    </Card>
  );
}
