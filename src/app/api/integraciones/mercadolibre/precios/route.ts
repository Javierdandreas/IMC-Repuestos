import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import {
  getEstadoActualizacionesPrecioMercadoLibre,
  procesarActualizacionesPrecioMercadoLibre,
} from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const accountSchema = z.coerce.number().int().positive();
const processSchema = z.object({
  idCuenta: accountSchema,
  limite: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const idCuenta = accountSchema.parse(request.nextUrl.searchParams.get("idCuenta"));
    return NextResponse.json(await getEstadoActualizacionesPrecioMercadoLibre(idCuenta), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error, "No se pudo consultar el estado de precios de Mercado Libre.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const payload = processSchema.parse(await request.json());
    const resultado = await procesarActualizacionesPrecioMercadoLibre(payload.limite ?? 50, payload.idCuenta);
    const estado = await getEstadoActualizacionesPrecioMercadoLibre(payload.idCuenta);
    return NextResponse.json({ ...resultado, estado }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron actualizar los precios pendientes en Mercado Libre.");
  }
}
