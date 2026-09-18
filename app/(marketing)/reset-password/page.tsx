import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Reset password",
  description: "Choose a new password.",
  path: "/reset-password",
});

export default function ResetPasswordPage() {
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold text-foreground">Choose a new password</h1>
        </div>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </Card>
    </Container>
  );
}
