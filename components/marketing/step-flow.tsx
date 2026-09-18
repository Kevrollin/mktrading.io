import { cn } from "@/lib/utils";

export interface Step {
  title: string;
  description: string;
}

export function StepFlow({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-6", className)}>
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums text-foreground">
            {index + 1}
          </span>
          <div className="flex flex-col gap-1 pt-1">
            <p className="text-base font-semibold text-foreground">{step.title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
