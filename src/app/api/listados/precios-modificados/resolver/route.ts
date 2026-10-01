import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { resolverCambiosCostoReferencia } from "@/lib/repos/proveedor-importaciones";

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiWriteSession(request);
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : [];
    const accion = body?.accion === "APROBAR" || body?.accion === "RECHAZAR" ? body.accion : null;
    if (!accion) {
      return NextResponse.json({ message: "Accion invalida." }, { status: 400 });
    }

    const result = await resolverCambiosCostoReferencia(ids, accion, session.usuarioId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo resolver el cambio de costo.");
  }
}
