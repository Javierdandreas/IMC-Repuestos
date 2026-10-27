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
    const result = body.modo === "ENRIQUECER"
      ? await enriquecerCatalogoVehiculosMercadoLibre()
      : await sincronizarCatalogoVehiculosMercadoLibre(body.reiniciar === true);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el catalogo de vehiculos.");
  }
}
