import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import {
  getCostoSincronizacionMercadoLibre,
  iniciarCostoSincronizacionMercadoLibre,
  procesarCostoSincronizacionMercadoLibre,
} from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  idCuenta: z.coerce.number().int().positive(),
  incluirPausadas: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const idCuenta = z.coerce.number().int().positive().parse(request.nextUrl.searchParams.get("idCuenta"));
    return NextResponse.json(await getCostoSincronizacionMercadoLibre(idCuenta), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo consultar el avance de Costos ML.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const payload = schema.parse(await request.json());
    return NextResponse.json(await iniciarCostoSincronizacionMercadoLibre(payload.idCuenta, payload.incluirPausadas), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error, "No se pudo iniciar la actualizacion masiva de Costos ML.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const payload = schema.pick({ idCuenta: true }).parse(await request.json());
    const result = await procesarCostoSincronizacionMercadoLibre(payload.idCuenta);
    if (!result) throw new AppError("No hay una actualizacion masiva pendiente.", 404);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo procesar el lote de Costos ML.");
  }
}
