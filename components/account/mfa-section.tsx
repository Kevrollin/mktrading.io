"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";

function toStepUpPayload(value: string): { password?: string; code?: string } {
  return /^\d{6,10}$/.test(value) ? { code: value } : { password: value };
}

export function MfaSection({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [enrolling, setEnrolling] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [showDisable, setShowDisable] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function beginEnroll() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/account/mfa/enroll", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setEnrolling(true);
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const code = new FormData(event.currentTarget).get("code");
    try {
      const response = await apiFetch("/api/account/mfa/confirm", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Incorrect code.");
        return;
      }
      setBackupCodes(data.backupCodes);
      setEnabled(true);
      setEnrolling(false);
    } finally {
      setLoading(false);
    }
  }

  async function submitDisable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const value = String(new FormData(event.currentTarget).get("stepUp") ?? "");
    try {
      const response = await apiFetch("/api/account/mfa/disable", {
        method: "POST",
        body: JSON.stringify(toStepUpPayload(value)),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setEnabled(false);
      setShowDisable(false);
    } finally {
      setLoading(false);
    }
  }

  async function submitRegenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const value = String(new FormData(event.currentTarget).get("stepUp") ?? "");
    try {
      const response = await apiFetch("/api/account/mfa/backup-codes", {
        method: "POST",
        body: JSON.stringify(toStepUpPayload(value)),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setBackupCodes(data.backupCodes);
      setShowRegenerate(false);
    } finally {
      setLoading(false);
    }
  }

  if (backupCodes) {
    return (
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-foreground">Save your backup codes</h2>
        <p className="text-sm text-muted-foreground">
          Store these somewhere safe. Each one works once if you lose access to your authenticator
          app. They won&apos;t be shown again.
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-[var(--radius)] border border-border bg-muted p-4 font-mono text-sm text-foreground">
          {backupCodes.map((code) => (
            <span key={code}>{code}</span>
          ))}
        </div>
        <Button type="button" onClick={() => setBackupCodes(null)} className="self-start">
          Done
        </Button>
      </Card>
    );
  }

  if (enrolling && qrDataUrl && secret) {
    return (
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Set up two-factor authentication
        </h2>
        <p className="text-sm text-muted-foreground">
          Scan this QR code with your authenticator app, or enter the code manually.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="Two-factor authentication QR code" className="h-40 w-40 self-center" />
        <p className="break-all text-center font-mono text-sm text-muted-foreground">{secret}</p>
        <form onSubmit={confirmEnroll} className="flex flex-col gap-4">
          <Field label="Enter the 6-digit code" htmlFor="code">
            <Input
              id="code"
              name="code"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
            />
          </Field>
          {error ? (
            <Callout variant="danger">
              <p>{error}</p>
            </Callout>
          ) : null}
          <Button type="submit" disabled={loading} className="self-start">
            {loading ? "Verifying..." : "Confirm"}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Two-factor authentication</h2>
        <Badge variant={enabled ? "positive" : "neutral"}>{enabled ? "Enabled" : "Disabled"}</Badge>
      </div>

      {!enabled ? (
        <>
          <p className="text-sm text-muted-foreground">
            Add an extra layer of security to your account.
          </p>
          {error ? (
            <Callout variant="danger">
              <p>{error}</p>
            </Callout>
          ) : null}
          <Button type="button" onClick={beginEnroll} disabled={loading} className="self-start">
            {loading ? "Starting..." : "Enable two-factor authentication"}
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowRegenerate((value) => !value);
                setShowDisable(false);
                setError(null);
              }}
            >
              Regenerate backup codes
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-negative/30 text-negative hover:bg-negative/10"
              onClick={() => {
                setShowDisable((value) => !value);
                setShowRegenerate(false);
                setError(null);
              }}
            >
              Disable
            </Button>
          </div>

          {showDisable ? (
            <form onSubmit={submitDisable} className="flex flex-col gap-3 border-t border-border pt-4">
              <Field label="Current password or a verification code" htmlFor="stepUpDisable">
                <Input id="stepUpDisable" name="stepUp" required />
              </Field>
              {error ? (
                <Callout variant="danger">
                  <p>{error}</p>
                </Callout>
              ) : null}
              <Button
                type="submit"
                disabled={loading}
                className="self-start border-negative/30 bg-negative text-white hover:opacity-90"
              >
                {loading ? "Disabling..." : "Confirm disable"}
              </Button>
            </form>
          ) : null}

          {showRegenerate ? (
            <form onSubmit={submitRegenerate} className="flex flex-col gap-3 border-t border-border pt-4">
              <Field label="Current password or a verification code" htmlFor="stepUpRegenerate">
                <Input id="stepUpRegenerate" name="stepUp" required />
              </Field>
              {error ? (
                <Callout variant="danger">
                  <p>{error}</p>
                </Callout>
              ) : null}
              <Button type="submit" disabled={loading} className="self-start">
                {loading ? "Regenerating..." : "Confirm regenerate"}
              </Button>
            </form>
          ) : null}
        </>
      )}
    </Card>
  );
}
