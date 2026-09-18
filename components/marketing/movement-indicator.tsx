import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatChangePercent } from "@/lib/format";

interface MovementIndicatorProps {
  changePercent: number;
  className?: string;
}

// Color is never the only signal: an icon and a signed percentage always
// accompany it, so the direction reads correctly for colorblind users too.
export function MovementIndicator({ changePercent, className }: MovementIndicatorProps) {
  const direction = changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const colorClass =
    direction === "up"
      ? "text-positive"
      : direction === "down"
        ? "text-negative"
        : "text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium tabular-nums",
        colorClass,
        className,
      )}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {formatChangePercent(changePercent)}
    </span>
  );
}
