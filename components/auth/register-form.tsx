"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";
import { issuesToFieldErrors } from "@/lib/auth/form-errors";

const checkboxClass =
  "mt-0.5 h-4 w-4 shrink-0 rounded border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RegisterForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      fullName: form.get("fullName"),
      email: form.get("email"),
      phone: form.get("phone"),
      country: form.get("country"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
      dateOfBirth: form.get("dateOfBirth"),
      termsAccepted: form.get("termsAccepted") === "on",
      riskDisclosureAccepted: form.get("riskDisclosureAccepted") === "on",
      website: form.get("website") ?? "",
    };

    try {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrors(issuesToFieldErrors(data.issues));
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
        <p>
          We&apos;ve sent a verification link to the email you provided. Click it to finish
          setting up your account.
        </p>
      </Callout>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {/* Honeypot: hidden from real users, visible to naive bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
        <Input id="fullName" name="fullName" autoComplete="name" required minLength={2} />
      </Field>

      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field
        label="Phone number"
        htmlFor="phone"
        error={errors.phone}
        hint="Include country code, e.g. +2547..."
      >
        <Input id="phone" name="phone" type="tel" autoComplete="tel" required minLength={7} />
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
          required
          minLength={2}
          maxLength={2}
          className="uppercase"
        />
      </Field>

      <Field label="Date of birth" htmlFor="dateOfBirth" error={errors.dateOfBirth}>
        <Input id="dateOfBirth" name="dateOfBirth" type="date" autoComplete="bday" required />
      </Field>

      <Field
        label="Password"
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

      <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
      </Field>

      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="termsAccepted" required className={checkboxClass} />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="text-accent underline-offset-4 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-accent underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {errors.termsAccepted ? (
        <p role="alert" className="text-sm text-negative">
          {errors.termsAccepted}
        </p>
      ) : null}

      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="riskDisclosureAccepted" required className={checkboxClass} />
        <span>
          I&apos;ve read and understood the{" "}
          <Link href="/risk-disclosure" className="text-accent underline-offset-4 hover:underline">
            Risk Disclosure
          </Link>{" "}
          — trading can result in the loss of my full stake.
        </span>
      </label>
      {errors.riskDisclosureAccepted ? (
        <p role="alert" className="text-sm text-negative">
          {errors.riskDisclosureAccepted}
        </p>
      ) : null}

      {formError ? (
        <Callout variant="danger">
          <p>{formError}</p>
        </Callout>
      ) : null}

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? "Creating account..." : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-accent underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
