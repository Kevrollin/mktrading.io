import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Login",
  description: "Account access is launching in the next milestone.",
  path: "/login",
});

export default function LoginPage() {
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Lock aria-hidden="true" className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Account access is coming soon</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Login is launching in the next milestone, alongside secure registration and identity
          verification. There&apos;s nothing to sign in to yet — this page is a placeholder, not a
          working form.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </Card>
    </Container>
  );
}
