import { cn } from "@/lib/utils";
import type { SecurityItem } from "@/types/security";

export function SecurityGrid({ items, className }: { items: SecurityItem[]; className?: string }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.title}
            className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-accent/10 text-accent">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </div>
            <p className="text-base font-semibold text-foreground">{item.title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}
