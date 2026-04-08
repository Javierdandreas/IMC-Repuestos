"use client";

import { createContext, useContext, ReactNode } from "react";
import { AuthenticatedInternalUser } from "@/lib/auth";
import { canManageContent } from "@/lib/permissions";

type UserContextType = {
  user: AuthenticatedInternalUser | null;
  canManage: boolean;
  isLoading: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: AuthenticatedInternalUser | null;
}) {
  const canManage = initialUser ? canManageContent(initialUser.rol) : false;

  return (
    <UserContext.Provider
      value={{
        user: initialUser,
        canManage,
        isLoading: false, // Since it's hydrated from the server, it's never loading in the first render
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
