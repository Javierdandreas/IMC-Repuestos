import { NextRequest, NextResponse } from "next/server";
import { sincronizarCotizacionesAutomaticas } from "@/lib/multimoneda";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const providedSecret = request.headers.get("x-imc-multimoneda-cron");
  const secret = process.env.MULTIMONEDA_CRON_SECRET;
  return Boolean(secret) && providedSecret === secret;
}

export async function GET(request: NextRequest) {
  if (!process.env.MULTIMONEDA_CRON_SECRET) {
    console.error("[MULTIMONEDA CRON] Falta configurar MULTIMONEDA_CRON_SECRET.");
    return NextResponse.json({ message: "Cron no configurado." }, { status: 503 });
  }
  try {
    if (!isAuthorized(request)) return NextResponse.json({ message: "No autorizado.", encabezadoRecibido: Boolean(request.headers.get("x-imc-multimoneda-cron")) }, { status: 401 });
    return NextResponse.json({ ok: true, ...(await sincronizarCotizacionesAutomaticas()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[MULTIMONEDA CRON] Error al actualizar cotizaciones:", error);
    return NextResponse.json({ message: "No se pudieron actualizar las cotizaciones." }, { status: 500 });
  }
}
