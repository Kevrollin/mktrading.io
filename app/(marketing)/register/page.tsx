import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Create account",
  description: "Create your MKTrading account.",
  path: "/register",
});

export default function RegisterPage() {
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Trading involves risk of loss. You must be 18 or older.
          </p>
        </div>
        <RegisterForm />
      </Card>
    </Container>
  );
}
