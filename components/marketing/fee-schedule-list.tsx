import { Card } from "@/components/ui/card";
import type { FeeScheduleItem } from "@/lib/legal-content";

export function FeeScheduleList({ items }: { items: FeeScheduleItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <Card
          key={item.label}
          className="flex flex-col gap-1 p-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
        >
          <p className="text-base font-semibold text-foreground">{item.label}</p>
          <div className="sm:text-right">
            <p className="text-sm font-medium tabular-nums text-foreground">{item.value}</p>
            {item.note ? <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
