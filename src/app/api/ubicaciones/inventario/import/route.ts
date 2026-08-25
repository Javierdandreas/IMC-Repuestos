import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { importSeriesUbicaciones } from "@/lib/repos/series-import";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiWriteSession(request);
    const body = await request.json();

    if (!Array.isArray(body.items)) {
      throw new Error("Formato de importacion invalido");
    }

    const result = await importSeriesUbicaciones(
      body.items,
      body.mappings ?? {},
      session.usuarioId
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo importar el inventario de series");
  }
}
