"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InstrumentRow } from "@/lib/trading/instruments-service";

export function InstrumentPicker({
  instruments,
  selectedId,
  onSelect,
}: {
  instruments: InstrumentRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {instruments.map((instrument) => (
        <button key={instrument.id} type="button" onClick={() => onSelect(instrument.id)} className="text-left">
          <Card
            className={cn(
              "flex flex-col gap-1 p-4 transition-colors",
              selectedId === instrument.id ? "border-accent" : "hover:border-muted-foreground/30",
            )}
          >
            <span className="text-sm font-semibold text-foreground">{instrument.symbol}</span>
            <span className="text-xs text-muted-foreground">{instrument.name}</span>
            <Badge variant="neutral" className="mt-1 w-fit capitalize">
              {instrument.category.replace("-", " ")}
            </Badge>
          </Card>
        </button>
      ))}
    </div>
  );
}
