"use client";

import {
  createContext,
  startTransition,
  useContext,
  useState,
} from "react";
import type { PublicUser } from "@/types/account";

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: PublicUser | null;
}) {
  const [user, setUser] = useState<PublicUser | null>(initialUser);
  const [loading, setLoading] = useState(false);

  async function refreshUser() {
    setLoading(true);

    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const payload = (await response.json()) as { user: PublicUser | null };
      startTransition(() => setUser(payload.user));
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
