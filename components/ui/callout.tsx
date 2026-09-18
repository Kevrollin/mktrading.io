import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const calloutVariants = cva("flex gap-3 rounded-[var(--radius)] border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-border bg-muted text-foreground",
      warning: "border-warning/30 bg-warning/10 text-foreground",
      danger: "border-negative/30 bg-negative/10 text-foreground",
      success: "border-positive/30 bg-positive/10 text-foreground",
    },
  },
  defaultVariants: { variant: "info" },
});

const iconByVariant = {
  info: Info,
  warning: AlertTriangle,
  danger: OctagonAlert,
  success: CheckCircle2,
} as const;

const iconColorByVariant = {
  info: "text-muted-foreground",
  warning: "text-warning",
  danger: "text-negative",
  success: "text-positive",
} as const;

export interface CalloutProps extends VariantProps<typeof calloutVariants> {
  title?: string;
  children: ReactNode;
  className?: string;
}

// Static, page-embedded notice — deliberately not role="alert", which is reserved
// for content injected dynamically in response to an action.
export function Callout({ variant = "info", title, children, className }: CalloutProps) {
  const activeVariant = variant ?? "info";
  const Icon = iconByVariant[activeVariant];

  return (
    <div className={cn(calloutVariants({ variant }), className)}>
      <Icon aria-hidden="true" className={cn("mt-0.5 h-5 w-5 shrink-0", iconColorByVariant[activeVariant])} />
      <div className="space-y-1 [&_p]:leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
