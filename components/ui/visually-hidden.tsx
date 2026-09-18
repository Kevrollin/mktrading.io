import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function VisuallyHidden({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("sr-only", className)} {...props} />;
}
