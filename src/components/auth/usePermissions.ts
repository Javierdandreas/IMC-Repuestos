"use client";

import { useUser } from "@/context/UserContext";

export function usePermissions() {
  const { user, canManage, isLoading } = useUser();

  return {
    loading: isLoading,
    rol: user?.rol ?? null,
    activo: user?.activo ?? false,
    canManage: canManage,
  };
}
