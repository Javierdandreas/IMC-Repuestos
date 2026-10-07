import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { sincronizarMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    const idCuenta = z.coerce.number().int().positive().parse(body.idCuenta);
    return NextResponse.json(await sincronizarMercadoLibre(idCuenta));
  } catch (error) {
    return jsonError(error, "No se pudieron sincronizar las publicaciones de Mercado Libre.");
  }
}
