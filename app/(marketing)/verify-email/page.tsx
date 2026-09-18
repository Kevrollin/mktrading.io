import { and, eq, gt, isNull } from "drizzle-orm";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { db } from "@/lib/db/client";
import { emailVerificationTokens, users } from "@/lib/db/schema";
import { hashToken } from "@/lib/auth/tokens";

// Depends on searchParams and performs a mutation on render — must never
// be cached/statically served.
export const dynamic = "force-dynamic";

type ClaimResult = "verified" | "already-verified" | "invalid";

/**
 * Resolves the user solely from the token row, never an ambient session —
 * otherwise a logged-in victim opening someone else's link risks
 * cross-account mixups. The claim itself is one atomic conditional UPDATE
 * so this is safe to run more than once for the same token: a corporate
 * email-gateway link-scanner prefetching this GET before a human clicks
 * it burns the token early, and the second (human) hit correctly falls
 * through to the "already verified" soft-success branch below rather
 * than a scary error.
 */
async function claimVerificationToken(rawToken: string): Promise<ClaimResult> {
  const tokenHash = hashToken(rawToken);

  const claimedUserId = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(emailVerificationTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.consumedAt),
          gt(emailVerificationTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: emailVerificationTokens.userId });

    if (!claimed) return null;

    await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, claimed.userId));
    return claimed.userId;
  });

  if (claimedUserId) return "verified";

  const [tokenRow] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash));

  if (tokenRow?.consumedAt) {
    const [user] = await db.select().from(users).where(eq(users.id, tokenRow.userId));
    if (user?.emailVerifiedAt) return "already-verified";
  }

  return "invalid";
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const status: ClaimResult = token ? await claimVerificationToken(token) : "invalid";

  if (status === "invalid") {
    return (
      <Container className="flex min-h-[60vh] items-center justify-center py-16">
        <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
          <XCircle aria-hidden="true" className="h-10 w-10 text-negative" />
          <h1 className="text-xl font-semibold text-foreground">This link is invalid or has expired</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Request a new verification email from the login page, or contact support if the problem
            continues.
          </p>
          <Button asChild variant="outline">
            <Link href="/login">Back to login</Link>
          </Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-16">
      <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <CheckCircle2 aria-hidden="true" className="h-10 w-10 text-positive" />
        <h1 className="text-xl font-semibold text-foreground">
          {status === "already-verified" ? "Your email is already verified" : "Email verified"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You&apos;re all set. You can now log in to your account.
        </p>
        <Button asChild>
          <Link href="/login">Continue to login</Link>
        </Button>
      </Card>
    </Container>
  );
}
