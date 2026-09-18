"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";
import { issuesToFieldErrors } from "@/lib/auth/form-errors";

export function ChangePasswordForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    setSuccess(false);

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      currentPassword: data.get("currentPassword"),
      newPassword: data.get("newPassword"),
      confirmNewPassword: data.get("confirmNewPassword"),
    };

    try {
      const response = await apiFetch("/api/account/change-password", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setErrors(issuesToFieldErrors(result.issues));
        setFormError(result.error ?? "Something went wrong.");
        return;
      }
      setSuccess(true);
      form.reset();
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-foreground">Change password</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword}>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Field
          label="New password"
          htmlFor="newPassword"
          error={errors.newPassword}
          hint="At least 12 characters."
        >
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
          />
        </Field>
        <Field
          label="Confirm new password"
          htmlFor="confirmNewPassword"
          error={errors.confirmNewPassword}
        >
          <Input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
          />
        </Field>
        {success ? (
          <Callout variant="success">
            <p>Password updated. Other sessions and devices have been signed out.</p>
          </Callout>
        ) : null}
        {formError ? (
          <Callout variant="danger">
            <p>{formError}</p>
          </Callout>
        ) : null}
        <Button type="submit" disabled={loading} className="self-start">
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
    </Card>
  );
}
