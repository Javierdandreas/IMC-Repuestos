import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { esAtributoVehiculo, normalizarAtributosVehiculo, obtenerValoresVehiculosCanonicos } from "@/lib/catalogo-vehiculos-mercadolibre";
import { consultarValoresVehiculoMercadoLibreParaContextos } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseKnownAttributes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => normalizarAtributosVehiculo([entry])).slice(0, 100);
}

export async function POST(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const body = await request.json() as { attributeId?: unknown; knownAttributes?: unknown; origen?: unknown };
    const knownAttributes = parseKnownAttributes(body.knownAttributes);
    const values = body.origen === "IMC"
      ? esAtributoVehiculo(body.attributeId)
        ? await obtenerValoresVehiculosCanonicos(body.attributeId, knownAttributes)
        : []
      : await consultarValoresVehiculoMercadoLibreParaContextos(body.attributeId, knownAttributes);
    return NextResponse.json({ values }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron consultar los valores de vehiculos.");
  }
}
