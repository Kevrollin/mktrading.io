"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface StepUpActionProps {
  title: string;
  description?: string;
  confirmLabel: string;
  variant?: "primary" | "outline";
  extraFields?: ReactNode;
  /** Returns an error message on failure, or null on success. */
  onSubmit: (formData: FormData) => Promise<string | null>;
}

/** Every admin wallet action needs a fresh MFA code alongside whatever
 * action-specific fields it takes — this is the one shared shell for
 * that, used by approve/reject/mark-processing/mark-completed. */
export function StepUpAction({
  title,
  description,
  confirmLabel,
  variant = "primary",
  extraFields,
  onSubmit,
}: StepUpActionProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = event.currentTarget;
    const result = await onSubmit(new FormData(form));
    if (result) {
      setError(result);
    } else {
      form.reset();
    }
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4"
    >
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {extraFields}
      <Field label="Your MFA code" htmlFor={`code-${title}`} error={error ?? undefined}>
        <Input
          id={`code-${title}`}
          name="code"
          inputMode="numeric"
          placeholder="6-digit code"
          required
          minLength={6}
          maxLength={10}
        />
      </Field>
      <Button type="submit" variant={variant} disabled={loading} className="self-start">
        {loading ? "Submitting..." : confirmLabel}
      </Button>
    </form>
  );
}
