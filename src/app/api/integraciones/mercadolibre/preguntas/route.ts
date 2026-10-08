import { NextRequest, NextResponse } from "next/server";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getMercadoLibrePreguntas, type MercadoLibrePreguntaEstadoFiltro, type MercadoLibrePreguntaOrden } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const idCuenta = Number(request.nextUrl.searchParams.get("idCuenta"));
    if (!Number.isInteger(idCuenta) || idCuenta <= 0) throw new AppError("La cuenta de Mercado Libre no es valida.", 400);
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
    const estado = request.nextUrl.searchParams.get("estado");
    const orden = request.nextUrl.searchParams.get("orden");
    const estadoFiltro: MercadoLibrePreguntaEstadoFiltro = estado === "RESPONDIDAS" ? "RESPONDIDAS" : "POR_RESPONDER";
    const ordenFecha: MercadoLibrePreguntaOrden = orden === "ASC" ? "ASC" : "DESC";
    return NextResponse.json(await getMercadoLibrePreguntas(idCuenta, page, 50, estadoFiltro, ordenFecha), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron consultar las preguntas de Mercado Libre.");
  }
}
