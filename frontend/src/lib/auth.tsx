"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "./api";

export type Level = "none" | "view" | "full";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  permissions: string;
  /** What this user's role may do in each module, e.g. { customers: "view", invoices: "full" }. */
  access: Record<string, Level>;
}

interface AuthState {
  user: AuthUser | undefined;
  /** True until we know whether there is a signed-in user. */
  loading: boolean;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
  /** Super admin (role permissions "all"). */
  isAdmin: boolean;
  /** The module can be opened. Module keys are the API paths ("team-members", "master-pay-sheet"...). */
  canView: (module: string) => boolean;
  /** Records in the module can be added, edited and deleted. */
  canEdit: (module: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null | undefined>(undefined);

  useEffect(() => setTokenState(getToken()), []);

  // Re-read regularly so a module switched on or off by an admin shows up without signing in again.
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<AuthUser>("/auth/me")).data,
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // A token the server rejects (account deleted, secret changed) is dropped, so the app shows the sign-in page.
  useEffect(() => {
    if (me.isError) {
      setToken(null);
      setTokenState(null);
    }
  }, [me.isError]);

  const signIn = useCallback(
    (newToken: string, user: AuthUser) => {
      setToken(newToken);
      queryClient.setQueryData(["me"], user);
      setTokenState(newToken);
    },
    [queryClient]
  );

  const signOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(() => {
    const user = token ? me.data : undefined;
    const level = (module: string): Level => user?.access?.[module] || "none";
    return {
      user,
      loading: token === undefined || (!!token && me.isPending),
      signIn,
      signOut,
      isAdmin: user?.permissions === "all",
      canView: (module) => level(module) !== "none",
      canEdit: (module) => level(module) === "full",
    };
  }, [token, me.data, me.isPending, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
