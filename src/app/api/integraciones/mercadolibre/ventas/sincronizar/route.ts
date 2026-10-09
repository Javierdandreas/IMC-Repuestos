import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { sincronizarVentasMercadoLibreAhora } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const body = await request.json();
    const idCuenta = z.coerce.number().int().positive().parse(body.idCuenta);
    const actualizadas = await sincronizarVentasMercadoLibreAhora(idCuenta);
    return NextResponse.json({ actualizadas }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron actualizar las ventas de Mercado Libre.");
  }
}
