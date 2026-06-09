import { redirect } from "next/navigation";
import { ProfilePageShell } from "@/components/profile-page-shell";
import { getSessionUser } from "@/lib/auth";
import { getPrivateUser } from "@/lib/account-store";

export default async function ProfilePage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return <ProfilePageShell library={[]} />;
  }

  const user = await getPrivateUser(sessionUser.id);

  if (!user) {
    redirect("/");
  }

  return (
    <ProfilePageShell
      library={user.libraryEntries}
    />
  );
}
