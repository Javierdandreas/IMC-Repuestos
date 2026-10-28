import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { estadoCatalogoVehiculosMercadoLibre } from "@/lib/catalogo-vehiculos-mercadolibre";
import { enriquecerCatalogoVehiculosMercadoLibre, sincronizarCatalogoVehiculosMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    return NextResponse.json(await estadoCatalogoVehiculosMercadoLibre(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo consultar el catalogo de vehiculos.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json().catch(() => ({})) as { reiniciar?: unknown; modo?: unknown };
    const startedAt = Date.now();
    const result = body.modo === "ENRIQUECER"
      ? await enriquecerCatalogoVehiculosMercadoLibre()
      : await sincronizarCatalogoVehiculosMercadoLibre(body.reiniciar === true);
    const duracionMs = Date.now() - startedAt;
    console.info(`[catalogo vehiculos] ${body.modo === "ENRIQUECER" ? "enriquecimiento" : "base"}: ${result.tareasProcesadas} tareas, ${result.vehiculosGenerados} vehiculos, ${Math.floor(duracionMs / 60_000)}m ${Math.round((duracionMs % 60_000) / 1_000)}s`);
    return NextResponse.json({ ...result, duracionMs }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el catalogo de vehiculos.");
  }
}
