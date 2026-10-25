import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { esAtributoVehiculo, explorarCatalogoVehiculos, normalizarAtributosVehiculo } from "@/lib/catalogo-vehiculos-mercadolibre";

export const dynamic = "force-dynamic";

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFilters(value: string | null) {
  if (!value) return [];
  try {
    return normalizarAtributosVehiculo(JSON.parse(value));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const searchParams = request.nextUrl.searchParams;
    const requestedAttribute = searchParams.get("attribute") || "";
    return NextResponse.json(await explorarCatalogoVehiculos({
      search: searchParams.get("q") || "",
      attributeId: esAtributoVehiculo(requestedAttribute) ? requestedAttribute : undefined,
      brandId: searchParams.get("brand") || "",
      filters: parseFilters(searchParams.get("filters")),
      page: positiveInteger(searchParams.get("page"), 1),
      limit: 50,
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo explorar el catalogo de vehiculos.");
  }
}
