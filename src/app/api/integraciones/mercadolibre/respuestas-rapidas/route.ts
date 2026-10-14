import { NextRequest, NextResponse } from "next/server";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { getMercadoLibreRespuestasRapidas, guardarMercadoLibreRespuestaRapida } from "@/lib/mercadolibre-respuestas-rapidas";

export const dynamic = "force-dynamic";

function accountId(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("idCuenta"));
  if (!Number.isInteger(value) || value <= 0) throw new AppError("La cuenta de Mercado Libre no es valida.", 400);
  return value;
}

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    return NextResponse.json(await getMercadoLibreRespuestasRapidas(accountId(request)));
  } catch (error) {
    return jsonError(error, "No se pudieron consultar las respuestas rapidas.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const idCuenta = accountId(request);
    const body = await request.json();
    return NextResponse.json(await guardarMercadoLibreRespuestaRapida(idCuenta, body || {}), { status: 201 });
  } catch (error) {
    return jsonError(error, "No se pudo guardar la respuesta rapida.");
  }
}
