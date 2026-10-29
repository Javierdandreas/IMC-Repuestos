import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { getMercadoLibreRespuestasRapidas, guardarMercadoLibreRespuestaRapida } from "@/lib/mercadolibre-respuestas-rapidas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    return NextResponse.json(await getMercadoLibreRespuestasRapidas());
  } catch (error) {
    return jsonError(error, "No se pudieron consultar las respuestas rapidas.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    return NextResponse.json(await guardarMercadoLibreRespuestaRapida(body || {}), { status: 201 });
  } catch (error) {
    return jsonError(error, "No se pudo guardar la respuesta rapida.");
  }
}
