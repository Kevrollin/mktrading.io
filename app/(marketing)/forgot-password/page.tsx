import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Forgot password",
  description: "Request a password reset link.",
  path: "/forgot-password",
});

export default function ForgotPasswordPage() {
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold text-foreground">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ll email you a link to choose a new one.
          </p>
        </div>
        <ForgotPasswordForm />
      </Card>
    </Container>
  );
}
