import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <Badge variant="warning" className={cn("uppercase tracking-wide", className)}>
      Sample data — not live
    </Badge>
  );
}
