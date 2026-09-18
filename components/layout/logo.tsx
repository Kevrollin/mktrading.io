import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-foreground", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7 shrink-0" fill="none">
        <rect x="1" y="1" width="30" height="30" rx="8" className="stroke-current" strokeWidth="1.5" />
        <path
          d="M8 20L13 14L17.5 18L24 10"
          className="stroke-current"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="10" r="1.6" className="fill-current" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">
        MK<span className="text-accent">Trading</span>
      </span>
    </span>
  );
}
