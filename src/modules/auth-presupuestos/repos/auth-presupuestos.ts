"use client";

import type { UsuarioSistemaPresupuestos as UsuarioSistema } from "../types/auth-presupuestos";
import { supabasePresupuestos as supabase } from "./supabase-presupuestos";
import {
  clearLegacyBudgetUser,
  readLegacyBudgetUser,
  resolveLegacyBudgetUser,
  writeLegacyBudgetUser,
} from "./legacy-session-bridge";

function isBrowser() {
  return typeof window !== "undefined";
}

export async function loginSupabase(email: string, password: string): Promise<UsuarioSistema | null> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user || !isBrowser()) return null;

  try {
    const canonicalUser = await resolveLegacyBudgetUser({ allowCacheFallback: false });
    if (canonicalUser) {
      return canonicalUser;
    }
  } catch (sessionError) {
    console.warn(
      "[PresupuestosAuth] No se pudo derivar la sesion legacy desde /api/auth/me.",
      sessionError
    );
  }

  // TODO: eliminar este fallback cuando Presupuestos consuma solo sesion canonica.
  const lowerEmail = email.toLowerCase();
  let rolAsignado: UsuarioSistema["rol"] = "mostrador";
  let nombreAsignado = "";
  let idAsignado = "mostrador_gen";

  if (lowerEmail === "admin@gmail.com" || lowerEmail.includes("admin")) {
    rolAsignado = "administrador";
    nombreAsignado = "Administrador";
    idAsignado = "admin";
  } else if (lowerEmail === "imc-laureano@gmail.com") {
    rolAsignado = "mostrador";
    nombreAsignado = "Laureano";
    idAsignado = "laureano";
  } else if (lowerEmail === "imc-gonzalo@gmail.com") {
    rolAsignado = "mostrador";
    nombreAsignado = "Gonzalo";
    idAsignado = "gonzalo";
  } else if (lowerEmail === "imc-walter@gmail.com") {
    rolAsignado = "deposito";
    nombreAsignado = "Walter";
    idAsignado = "walter";
  } else if (lowerEmail === "imc-tiowal@gmail.com") {
    rolAsignado = "deposito";
    nombreAsignado = "TioWal";
    idAsignado = "tiowal";
  } else if (lowerEmail.includes("deposito")) {
    rolAsignado = "deposito";
    nombreAsignado = "Deposito";
    idAsignado = "deposito_gen";
  } else {
    rolAsignado = "mostrador";
    nombreAsignado = "Mostrador";
    idAsignado = "mostrador_gen";
  }

  const userRole: UsuarioSistema = {
    id: idAsignado,
    username: data.user.email || lowerEmail,
    password: "",
    nombre: nombreAsignado,
    rol: rolAsignado,
  };

  writeLegacyBudgetUser(userRole);
  return userRole;
}

export async function logout() {
  if (!isBrowser()) return;
  await supabase.auth.signOut();
  clearLegacyBudgetUser();
}

/**
 * TODO: deprecado. Devuelve solo el cache legacy local para compatibilidad.
 * La fuente real de sesion debe resolverse via `/api/auth/me`.
 */
export function getUsuarioActual(): UsuarioSistema | null {
  return readLegacyBudgetUser();
}

export function isLoggedIn() {
  return !!getUsuarioActual();
}
