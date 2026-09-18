"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";
import { issuesToFieldErrors } from "@/lib/auth/form-errors";

interface ProfileFormProps {
  fullName: string;
  country: string;
  phone: string;
}

export function ProfileForm({ fullName, country, phone }: ProfileFormProps) {
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

    const form = new FormData(event.currentTarget);
    const payload = {
      fullName: form.get("fullName"),
      country: form.get("country"),
      phone: form.get("phone"),
    };

    try {
      const response = await apiFetch("/api/account/profile", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(issuesToFieldErrors(data.issues));
        setFormError(data.error ?? "Something went wrong.");
        return;
      }
      setSuccess(true);
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
          <Input
            id="fullName"
            name="fullName"
            defaultValue={fullName}
            autoComplete="name"
            required
            minLength={2}
          />
        </Field>
        <Field
          label="Country"
          htmlFor="country"
          error={errors.country}
          hint="2-letter country code, e.g. KE, US, GB"
        >
          <Input
            id="country"
            name="country"
            defaultValue={country}
            required
            minLength={2}
            maxLength={2}
            className="uppercase"
          />
        </Field>
        <Field label="Phone number" htmlFor="phone" error={errors.phone}>
          <Input
            id="phone"
            name="phone"
            defaultValue={phone}
            type="tel"
            autoComplete="tel"
            required
            minLength={7}
          />
        </Field>
        {success ? (
          <Callout variant="success">
            <p>Profile updated.</p>
          </Callout>
        ) : null}
        {formError ? (
          <Callout variant="danger">
            <p>{formError}</p>
          </Callout>
        ) : null}
        <Button type="submit" disabled={loading} className="self-start">
          {loading ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}
