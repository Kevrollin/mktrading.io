import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Login",
  description: "Log in to your MKTrading account.",
  path: "/login",
});

export default function LoginPage() {
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold text-foreground">Log in</h1>
        </div>
        <LoginForm />
      </Card>
    </Container>
  );
}
