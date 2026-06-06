"use client";

import { useAuth } from "@/components/auth-provider";
import type { TitleLanguage } from "@/lib/format";

export function useTitleLanguage(): TitleLanguage {
  const { user } = useAuth();
  return user?.preferences.titleLanguage ?? "english";
}
