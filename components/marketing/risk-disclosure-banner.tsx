import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function RiskDisclosureBanner({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-4 border-warning/30 bg-warning/5 p-6 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex gap-3">
        <AlertTriangle aria-hidden="true" className="h-6 w-6 shrink-0 text-warning" />
        <div>
          <p className="text-base font-semibold text-foreground">Trading involves risk of loss</p>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            You can lose your full stake on a contract. MKTrading never promises guaranteed
            profit. Read the full risk disclosure before trading.
          </p>
        </div>
      </div>
      <Button asChild variant="outline" size="md" className="shrink-0">
        <Link href="/risk-disclosure">Read risk disclosure</Link>
      </Button>
    </Card>
  );
}
