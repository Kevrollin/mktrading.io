import type { ReactNode } from "react";
import { Callout } from "@/components/ui/callout";

// Fixed preset: wraps any jurisdiction-specific, licensing, or registration
// content so it's always visually distinct on the page, not just a code comment.
export function ComplianceNotice({ children }: { children: ReactNode }) {
  return (
    <Callout variant="warning" title="Pending qualified legal review">
      {children}
    </Callout>
  );
}
