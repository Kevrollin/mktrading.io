"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";
import { issuesToFieldErrors } from "@/lib/auth/form-errors";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <Callout variant="danger" title="Missing reset token">
        <p>
          This link is missing its token. Request a new{" "}
          <Link href="/forgot-password" className="underline underline-offset-4">
            password reset link
          </Link>
          .
        </p>
      </Callout>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      token,
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    };

    try {
      const response = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(issuesToFieldErrors(data.issues));
        setFormError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Callout variant="success" title="Password updated">
        <div className="flex flex-col gap-4">
          <p>Your password has been reset. All previous sessions have been signed out.</p>
          <Button asChild size="lg">
            <Link href="/login">Continue to login</Link>
          </Button>
        </div>
      </Callout>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field
        label="New password"
        htmlFor="password"
        error={errors.password}
        hint="At least 12 characters."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
      </Field>
      {formError ? (
        <Callout variant="danger">
          <p>{formError}</p>
        </Callout>
      ) : null}
      <Button type="submit" size="lg" disabled={loading}>
        {loading ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
