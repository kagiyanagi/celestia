import { ProfilePageShell } from "@/components/profile-page-shell";
import { getSessionUser } from "@/lib/auth";
import { getLibraryEntries } from "@/lib/account-store";

export default async function ProfilePage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return <ProfilePageShell library={[]} />;
  }

  const library = await getLibraryEntries(sessionUser.id);

  return <ProfilePageShell library={library} />;
}
