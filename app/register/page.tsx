import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Create account",
  description: "Account creation is launching in the next milestone.",
  path: "/register",
});

export default function RegisterPage() {
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <UserPlus aria-hidden="true" className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Account creation is coming soon</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Registration is launching in the next milestone, with identity verification and
          jurisdiction eligibility checks built in from the start. This page is a placeholder,
          not a working sign-up form.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/risk-disclosure">Read the risk disclosure</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </Card>
    </Container>
  );
}
