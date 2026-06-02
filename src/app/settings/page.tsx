import { redirect } from "next/navigation";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { getSessionUser } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/profile");
  }

  return <SettingsPageShell />;
}
