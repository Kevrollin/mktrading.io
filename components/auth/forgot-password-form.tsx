"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      identifier: form.get("identifier"),
      website: form.get("website") ?? "",
    };

    try {
      const response = await apiFetch("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setFormError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Callout variant="success" title="Check your email">
        <p>If an account matches what you entered, a password reset link is on its way.</p>
      </Callout>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <Field label="Email or phone" htmlFor="identifier">
        <Input id="identifier" name="identifier" autoComplete="username" required />
      </Field>
      {formError ? (
        <Callout variant="danger">
          <p>{formError}</p>
        </Callout>
      ) : null}
      <Button type="submit" size="lg" disabled={loading}>
        {loading ? "Sending..." : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-accent underline-offset-4 hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}
