"use client";

import { useUser } from "@/context/UserContext";
import { usePathname, useSearchParams } from "next/navigation";
import { permisoParaPagina } from "@/lib/permissions";

export function usePermissions() {
  const { user, can, isLoading } = useUser();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requisitos = permisoParaPagina(pathname, searchParams);
  const apartados = new Set((requisitos || []).map((permiso) => permiso.split(":")[0]));
  const canManage = user?.rol === "admin" || Boolean(user?.permisos.some((permiso) => {
    const [apartado, accion] = permiso.split(":");
    return apartados.has(apartado) && accion !== "leer";
  }));

  return {
    loading: isLoading,
    rol: user?.rol ?? null,
    activo: user?.activo ?? false,
    canManage: canManage,
    can,
  };
}
