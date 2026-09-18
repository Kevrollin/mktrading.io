import { eq } from "drizzle-orm";
import { ProfileForm } from "@/components/account/profile-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { profiles, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null; // layout already redirects unauthenticated requests

  const [user] = await db.select().from(users).where(eq(users.id, currentUser.id));
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, currentUser.id));
  if (!user || !profile) return null;

  return (
    <Container className="flex flex-col gap-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
      <Card className="flex flex-col gap-1 p-6">
        <p className="text-sm text-muted-foreground">Email</p>
        <p className="text-base text-foreground">{user.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Email address changes aren&apos;t supported yet — contact support if you need to update
          it.
        </p>
      </Card>
      <ProfileForm fullName={profile.fullName} country={profile.country} phone={user.phone} />
    </Container>
  );
}
