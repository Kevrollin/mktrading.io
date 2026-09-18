import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

// Dynamic validation feedback in response to a submit attempt — unlike
// Callout (static page content), role="alert" is the right call here.
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
