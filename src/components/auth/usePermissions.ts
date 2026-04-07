"use client";

import { useEffect, useState } from "react";

type PermissionsState = {
  loading: boolean;
  rol: string | null;
  activo: boolean;
  canManage: boolean;
};

const initialState: PermissionsState = {
  loading: true,
  rol: null,
  activo: false,
  canManage: false,
};

export function usePermissions() {
  const [state, setState] = useState<PermissionsState>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "No autorizado");
        }

        if (!cancelled) {
          setState({
            loading: false,
            rol: data.rol ?? null,
            activo: Boolean(data.activo),
            canManage: Boolean(data.canManage),
          });
        }
      } catch {
        if (!cancelled) {
          setState({ ...initialState, loading: false });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
