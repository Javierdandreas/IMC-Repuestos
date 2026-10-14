import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { sincronizarCotizacionesAutomaticas } from "@/lib/multimoneda";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    return NextResponse.json(await sincronizarCotizacionesAutomaticas(), { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron actualizar las cotizaciones automaticas.");
  }
}
