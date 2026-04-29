import { NextRequest, NextResponse } from "next/server";
import { requireApiReadSession } from "@/modules/auth/repos/api-auth";
import { canManageContent } from "@/modules/auth/repos/permissions";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiReadSession(request);

    return NextResponse.json({
      authUserId: session.authUserId,
      usuarioId: session.usuarioId,
      email: session.email,
      nombre: session.nombre,
      apellido: session.apellido,
      rol: session.rol,
      activo: session.activo,
      canManage: canManageContent(session.rol),
    });
  } catch (error: unknown) {
    return jsonError(error, "No autorizado");
  }
}
