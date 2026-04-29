import { NextRequest } from "next/server";
import { AppError } from "@/lib/api-errors";
import { verifyInternalUserFromRequest } from "./auth";
import { canManageContent, canReadContent, normalizeRole, tienePermiso, type AppPermission } from "./permissions";
import type { CanonicalRole } from "../types/auth.types";

export async function requireApiReadSession(request: NextRequest) {
  const session = await verifyInternalUserFromRequest(request);

  if (!session) {
    throw new AppError("No autorizado", 401);
  }

  if (!session.activo) {
    throw new AppError("Usuario inactivo", 403);
  }

  if (!canReadContent(session.rol)) {
    throw new AppError("Rol no habilitado", 403);
  }

  return session;
}

export async function requireApiWriteSession(request: NextRequest) {
  const session = await requireApiReadSession(request);

  if (!canManageContent(session.rol)) {
    throw new AppError("No autorizado para modificar informaciÃ³n", 403);
  }

  return session;
}

export async function requireApiPermission(
  request: NextRequest,
  permission: AppPermission
) {
  const session = await requireApiReadSession(request);

  if (!tienePermiso(session.rol, permission)) {
    throw new AppError(`No tenÃ©s permiso para esta acciÃ³n (${permission})`, 403);
  }

  return session;
}

export async function requireApiRole(
  request: NextRequest,
  allowedRoles: CanonicalRole[]
) {
  const session = await requireApiReadSession(request);
  const normalizedRole = normalizeRole(session.rol);

  if (!normalizedRole || !allowedRoles.includes(normalizedRole)) {
    throw new AppError("No autorizado para esta acciÃ³n", 403);
  }

  return session;
}

// Compatibilidad hacia atrÃ¡s con rutas que ya lo usan para lectura.
export const requireApiSession = requireApiReadSession;
