import { NextRequest } from "next/server";
import { AppError } from "@/lib/api-errors";
import { verifyInternalUserFromRequest } from "@/lib/auth";
import { canManageContent, canReadContent, normalizeRole } from "@/lib/permissions";

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
    throw new AppError("No autorizado para modificar información", 403);
  }

  return session;
}

export async function requireApiRole(
  request: NextRequest,
  allowedRoles: Array<"admin" | "empleado">
) {
  const session = await requireApiReadSession(request);
  const normalizedRole = normalizeRole(session.rol);

  if (!allowedRoles.includes(normalizedRole as "admin" | "empleado")) {
    throw new AppError("No autorizado para esta acción", 403);
  }

  return session;
}

// Compatibilidad hacia atrás con rutas que ya lo usan para lectura.
export const requireApiSession = requireApiReadSession;
