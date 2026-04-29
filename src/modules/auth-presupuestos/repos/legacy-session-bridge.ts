"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  RolUsuarioPresupuestos,
  UsuarioSistemaPresupuestos,
} from "../types/auth-presupuestos";

export const LEGACY_AUTH_USER_KEY = "imc_auth_user";
export const LEGACY_AUTH_USER_SYNC_EVENT = "imc:legacy-budget-user-sync";

type CanonicalBudgetSession = {
  authUserId: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  rol: string | null;
  activo?: boolean | null;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function emitLegacyBudgetUserSync() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(LEGACY_AUTH_USER_SYNC_EVENT));
}

export function mapCanonicalRoleToLegacyRole(
  role: string | null | undefined
): RolUsuarioPresupuestos {
  const normalizedRole = role?.trim().toLowerCase();

  switch (normalizedRole) {
    case "admin":
    case "supervisor":
      return "administrador";
    case "deposito":
      return "deposito";
    case "vendedor":
    case "empleado":
    case "catalogo":
    default:
      return "mostrador";
  }
}

export function buildLegacyBudgetUserFromCanonicalSession(
  session: CanonicalBudgetSession | null
): UsuarioSistemaPresupuestos | null {
  if (!session) return null;

  const nombreCompleto =
    `${session.nombre ?? ""} ${session.apellido ?? ""}`.trim() || "Usuario";

  return {
    id: session.authUserId,
    username: session.email || nombreCompleto,
    password: "",
    nombre: nombreCompleto,
    rol: mapCanonicalRoleToLegacyRole(session.rol),
  };
}

export function writeLegacyBudgetUser(user: UsuarioSistemaPresupuestos | null) {
  if (!isBrowser()) return;

  if (!user) {
    window.localStorage.removeItem(LEGACY_AUTH_USER_KEY);
    emitLegacyBudgetUserSync();
    return;
  }

  window.localStorage.setItem(LEGACY_AUTH_USER_KEY, JSON.stringify(user));
  emitLegacyBudgetUserSync();
}

export function readLegacyBudgetUser(): UsuarioSistemaPresupuestos | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(LEGACY_AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UsuarioSistemaPresupuestos;
  } catch {
    return null;
  }
}

export function clearLegacyBudgetUser() {
  writeLegacyBudgetUser(null);
}

export function syncLegacyBudgetUserFromInternalSession(
  session: CanonicalBudgetSession | null
) {
  const legacyUser = buildLegacyBudgetUserFromCanonicalSession(session);

  if (!legacyUser) {
    clearLegacyBudgetUser();
    return null;
  }

  writeLegacyBudgetUser(legacyUser);
  return legacyUser;
}

export async function fetchCanonicalBudgetSession(): Promise<CanonicalBudgetSession | null> {
  if (!isBrowser()) return null;

  const response = await fetch("/api/auth/me", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });

  if (response.status === 401 || response.status === 403) {
    clearLegacyBudgetUser();
    return null;
  }

  if (!response.ok) {
    throw new Error(`No se pudo obtener la sesion actual (${response.status}).`);
  }

  return (await response.json()) as CanonicalBudgetSession;
}

export async function resolveLegacyBudgetUser(options?: {
  allowCacheFallback?: boolean;
}) {
  const allowCacheFallback = options?.allowCacheFallback ?? true;

  try {
    const session = await fetchCanonicalBudgetSession();
    return syncLegacyBudgetUserFromInternalSession(session);
  } catch (error) {
    if (!allowCacheFallback) {
      throw error;
    }

    console.warn(
      "[PresupuestosAuth] No se pudo resolver la sesion canonica. Se usa cache legacy temporal.",
      error
    );
    return readLegacyBudgetUser();
  }
}

export function useUsuarioPresupuestosActual() {
  const [usuarioActual, setUsuarioActual] = useState<UsuarioSistemaPresupuestos | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carga inicial desde localStorage para evitar mismatch de hidratacion
    setUsuarioActual(readLegacyBudgetUser());
  }, []);

  const refreshUsuarioActual = useCallback(async () => {
    setLoading(true);
    const user = await resolveLegacyBudgetUser();
    setUsuarioActual(user);
    setLoading(false);
    return user;
  }, []);

  useEffect(() => {
    refreshUsuarioActual();
  }, [refreshUsuarioActual]);

  useEffect(() => {
    if (!isBrowser()) return;

    const handleSync = () => {
      setUsuarioActual(readLegacyBudgetUser());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LEGACY_AUTH_USER_KEY) {
        setUsuarioActual(readLegacyBudgetUser());
      }
    };

    window.addEventListener(LEGACY_AUTH_USER_SYNC_EVENT, handleSync);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(LEGACY_AUTH_USER_SYNC_EVENT, handleSync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return {
    usuarioActual,
    loading,
    refreshUsuarioActual,
  };
}
