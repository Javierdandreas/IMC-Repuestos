import { NextRequest, NextResponse } from "next/server";

import {
  getEstadoActualizacionesPrecioMercadoLibre,
  procesarActualizacionesPrecioMercadoLibre,
} from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ message: "No autorizado." }, { status: 401 });

  try {
    const resultado = await procesarActualizacionesPrecioMercadoLibre(50);
    const estado = await getEstadoActualizacionesPrecioMercadoLibre();
    return NextResponse.json({ ok: true, ...resultado, estado }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[MERCADO LIBRE PRECIOS CRON] No se pudieron procesar los precios pendientes:", error);
    return NextResponse.json({ message: "No se pudieron procesar los precios pendientes." }, { status: 500 });
  }
}
