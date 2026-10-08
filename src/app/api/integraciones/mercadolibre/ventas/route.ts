import { NextRequest, NextResponse } from "next/server";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getMercadoLibreVentas } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const idCuenta = Number(request.nextUrl.searchParams.get("idCuenta"));
    if (!Number.isInteger(idCuenta) || idCuenta <= 0) throw new AppError("La cuenta de Mercado Libre no es valida.", 400);
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
    return NextResponse.json(await getMercadoLibreVentas(idCuenta, page), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron consultar las ventas de Mercado Libre.");
  }
}
