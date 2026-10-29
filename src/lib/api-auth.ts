import { NextRequest } from "next/server";
import { AppError } from "@/lib/api-errors";
import { verifyInternalUserFromRequest } from "@/lib/auth";
import { canReadContent, normalizeRole } from "@/lib/permissions";

export async function requireApiReadSession(request: NextRequest) {
  const session = await verifyInternalUserFromRequest(request);

  if (!session) throw new AppError("No autorizado", 401);
  if (!session.activo) throw new AppError("Usuario inactivo", 403);
  if (!canReadContent(session.rol)) throw new AppError("Rol no habilitado", 403);

  return session;
}

export async function requireApiWriteSession(request: NextRequest) {
  // El middleware valida el permiso puntual antes de que una solicitud llegue
  // a cada API. Esta funcion mantiene la sesion para las rutas existentes.
  return requireApiReadSession(request);
}

export async function requireApiRole(
  request: NextRequest,
  allowedRoles: Array<"admin" | "empleado">
) {
  const session = await requireApiReadSession(request);
  const normalizedRole = normalizeRole(session.rol);

  if (!allowedRoles.includes(normalizedRole as "admin" | "empleado")) {
    throw new AppError("No autorizado para esta accion", 403);
  }

  return session;
}

// Compatibilidad hacia atras con rutas que ya lo usan para lectura.
export const requireApiSession = requireApiReadSession;
