import { NextRequest, NextResponse } from "next/server";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getMercadoLibreEstadisticas } from "@/lib/mercadolibre";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const idCuenta = Number(request.nextUrl.searchParams.get("idCuenta"));
    if (!Number.isInteger(idCuenta) || idCuenta <= 0) throw new AppError("La cuenta de Mercado Libre no es valida.", 400);
    const dias = Number(request.nextUrl.searchParams.get("dias"));
    const corte = request.nextUrl.searchParams.get("hasta");
    const hasta = corte ? new Date(z.iso.datetime({ offset:true }).parse(corte)) : new Date();
    return NextResponse.json(await getMercadoLibreEstadisticas(idCuenta, dias, hasta), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron obtener las estadisticas de Mercado Libre.");
  }
}
