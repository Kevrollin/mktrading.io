"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      identifier: form.get("identifier"),
      password: form.get("password"),
      website: form.get("website") ?? "",
    };

    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? "Something went wrong. Try again.");
        return;
      }

      if (data.mfaRequired) {
        setStep("mfa");
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      code: form.get("code"),
      rememberDevice: form.get("rememberDevice") === "on",
    };

    try {
      const response = await apiFetch("/api/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? "Something went wrong. Try again.");
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "mfa") {
    return (
      <form onSubmit={handleMfaSubmit} className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app, or one of your backup codes.
        </p>
        <Field label="Verification code" htmlFor="code">
          <Input
            id="code"
            name="code"
            autoComplete="one-time-code"
            required
            minLength={6}
            maxLength={10}
            autoFocus
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="rememberDevice"
            className="h-4 w-4 rounded border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          Remember this device for 30 days
        </label>
        {formError ? (
          <Callout variant="danger">
            <p>{formError}</p>
          </Callout>
        ) : null}
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-5" noValidate>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Field label="Email or phone" htmlFor="identifier">
        <Input id="identifier" name="identifier" autoComplete="username" required />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      {formError ? (
        <Callout variant="danger">
          <p>{formError}</p>
        </Callout>
      ) : null}

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? "Logging in..." : "Log in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-accent underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
