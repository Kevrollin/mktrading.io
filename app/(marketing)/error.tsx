"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-negative">Error</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Something went wrong
      </h1>
      <p className="max-w-md text-base leading-relaxed text-muted-foreground">
        An unexpected error occurred. You can try again, or head back to the homepage.
      </p>
      <Button type="button" size="lg" className="mt-2" onClick={reset}>
        Try again
      </Button>
    </Container>
  );
}
