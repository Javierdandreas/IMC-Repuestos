import { NextRequest } from "next/server";
import { AppError } from "@/lib/api-errors";
import { verifyInternalUserFromRequest } from "@/lib/auth";

export async function requireApiSession(request: NextRequest) {
  const session = await verifyInternalUserFromRequest(request);

  if (!session) {
    throw new AppError("No autorizado", 401);
  }

  if (!session.activo) {
    throw new AppError("Usuario inactivo", 403);
  }

  return session;
}

export async function requireApiRole(request: NextRequest, allowedRoles: string[]) {
  const session = await requireApiSession(request);

  if (!allowedRoles.includes(session.rol)) {
    throw new AppError("No autorizado", 403);
  }

  return session;
}
