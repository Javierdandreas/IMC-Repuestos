import { NextRequest, NextResponse } from "next/server";

import { jsonError, AppError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getMercadoLibrePublicaciones } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const idCuenta = Number(request.nextUrl.searchParams.get("idCuenta"));
    if (!Number.isInteger(idCuenta) || idCuenta <= 0) throw new AppError("La cuenta de Mercado Libre no es valida.", 400);
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
    const search = request.nextUrl.searchParams.get("q") || "";
    return NextResponse.json(await getMercadoLibrePublicaciones(idCuenta, page, 50, search), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron consultar las publicaciones de Mercado Libre.");
  }
}
