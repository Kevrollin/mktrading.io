import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ContactMethodCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  href: string;
  description?: string;
}

export function ContactMethodCard({
  icon: Icon,
  label,
  value,
  href,
  description,
}: ContactMethodCardProps) {
  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-accent/10 text-accent">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <a
          href={href}
          className="text-base font-semibold text-foreground underline-offset-4 hover:underline"
        >
          {value}
        </a>
      </div>
      {description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </Card>
  );
}
