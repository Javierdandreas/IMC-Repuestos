import { NextRequest, NextResponse } from "next/server";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getMercadoLibrePublicaciones } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const idCuenta = Number(request.nextUrl.searchParams.get("idCuenta"));
    if (!Number.isInteger(idCuenta) || idCuenta <= 0) throw new AppError("La cuenta de Mercado Libre no es valida.", 400);
    const search = request.nextUrl.searchParams.get("q") || "";
    const vinculo = request.nextUrl.searchParams.get("vinculo");
    const tipoVinculo = vinculo === "SIN_VINCULO" || vinculo === "EXCLUIDO_MANUAL" ? vinculo : undefined;
    const fechaDesde = request.nextUrl.searchParams.get("fechaDesde") || undefined;
    const fechaHasta = request.nextUrl.searchParams.get("fechaHasta") || undefined;
    const fechaValida = (value: string | undefined) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!fechaValida(fechaDesde) || !fechaValida(fechaHasta)) throw new AppError("La fecha de publicaciones no es valida.", 400);
    const result = await getMercadoLibrePublicaciones(idCuenta, 1, 10_000, search, tipoVinculo, fechaDesde, fechaHasta);
    return NextResponse.json({ data: result.data, totalCount: result.totalCount }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron preparar los MLA para copiar.");
  }
}
