import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { actualizarCostoEstimadoMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  idCuenta: z.coerce.number().int().positive(),
  itemId: z.string().trim().regex(/^ML[A-Z]+\d+$/i, "La publicacion de Mercado Libre no es valida."),
});

export async function POST(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const payload = schema.parse(await request.json());
    return NextResponse.json(await actualizarCostoEstimadoMercadoLibre(payload.idCuenta, payload.itemId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error, "No se pudo calcular el costo de Mercado Libre.");
  }
}
