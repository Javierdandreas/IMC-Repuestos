import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { normalizarAtributosVehiculo } from "@/lib/catalogo-vehiculos-mercadolibre";
import { consultarValoresVehiculoMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const body = await request.json() as { attributeId?: unknown; knownAttributes?: unknown };
    const values = await consultarValoresVehiculoMercadoLibre(body.attributeId, normalizarAtributosVehiculo(body.knownAttributes));
    return NextResponse.json({ values }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron consultar los valores de vehiculos.");
  }
}
