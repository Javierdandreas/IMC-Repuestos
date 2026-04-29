"use client";

import { useMemo } from "react";
import { useUser } from "@/context/UserContext";
import {
  canManageContent,
  esAdmin,
  getRolePermissions,
  puedeVerModulo,
  tieneAlgunPermiso,
  tienePermiso,
  tieneTodosLosPermisos,
  type AppModule,
  type AppPermission,
} from "@/modules/auth/repos/permissions";

export function usePermissions() {
  const { user, canManage, isLoading } = useUser();

  return useMemo(() => {
    const permissions = user ? getRolePermissions(user) : [];

    return {
      loading: isLoading,
      rol: user?.rol ?? null,
      activo: user?.activo ?? false,
      permissions,
      canManage,
      isAdmin: esAdmin(user),
      canManageContent: user ? canManageContent(user.rol) : false,
      hasPermission: (permission: AppPermission) => tienePermiso(user, permission),
      hasAnyPermission: (permissionList: AppPermission[]) =>
        tieneAlgunPermiso(user, permissionList),
      hasAllPermissions: (permissionList: AppPermission[]) =>
        tieneTodosLosPermisos(user, permissionList),
      canViewModule: (module: AppModule) => puedeVerModulo(user, module),
    };
  }, [canManage, isLoading, user]);
}
