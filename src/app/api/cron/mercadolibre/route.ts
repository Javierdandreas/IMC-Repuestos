import { NextRequest, NextResponse } from "next/server";

import { getMercadoLibreCuentas, procesarEventosMercadoLibrePendientes, sincronizarMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[MERCADO LIBRE CRON] Falta configurar CRON_SECRET.");
    return NextResponse.json({ message: "Cron no configurado." }, { status: 503 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  try {
    const eventos = await procesarEventosMercadoLibrePendientes(100);
    const cuentas = await getMercadoLibreCuentas();
    const resultados: Array<{ idCuenta: number; ok: boolean; total?: number; error?: string }> = [];

    for (const cuenta of cuentas) {
      try {
        const resultado = await sincronizarMercadoLibre(cuenta.id);
        resultados.push({ idCuenta: cuenta.id, ok: true, total: resultado.total });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido.";
        console.error(`[MERCADO LIBRE CRON] Error al sincronizar cuenta ${cuenta.id}:`, error);
        resultados.push({ idCuenta: cuenta.id, ok: false, error: message });
      }
    }

    const failed = resultados.filter((resultado) => !resultado.ok);
    return NextResponse.json({
      ok: failed.length === 0,
      eventos,
      cuentas: resultados,
      sincronizadas: resultados.filter((resultado) => resultado.ok).length,
      errores: failed.length,
    }, { status: failed.length ? 500 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[MERCADO LIBRE CRON] Error al preparar la sincronización:", error);
    return NextResponse.json({ message: "No se pudo iniciar la sincronización de Mercado Libre." }, { status: 500 });
  }
}
