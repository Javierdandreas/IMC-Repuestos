import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { esAtributoVehiculo, explorarCatalogoVehiculos, explorarVehiculosCanonicos, normalizarAtributosVehiculo } from "@/lib/catalogo-vehiculos-mercadolibre";
import { detallarVehiculosMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFilters(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => normalizarAtributosVehiculo([entry])).slice(0, 100);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const searchParams = request.nextUrl.searchParams;
    const filters = parseFilters(searchParams.get("filters"));
    if (searchParams.get("vehiculos") === "1") {
      return NextResponse.json(await explorarVehiculosCanonicos({
        filters,
        page: positiveInteger(searchParams.get("page"), 1),
        limit: 50,
      }), { headers: { "Cache-Control": "no-store" } });
    }
    if (searchParams.get("completo") === "1") {
      const data = await detallarVehiculosMercadoLibre(filters);
      return NextResponse.json({ data, page: 1, totalPages: 1, totalCount: data.length }, { headers: { "Cache-Control": "no-store" } });
    }
    const requestedAttribute = searchParams.get("attribute") || "";
    return NextResponse.json(await explorarCatalogoVehiculos({
      search: searchParams.get("q") || "",
      attributeId: esAtributoVehiculo(requestedAttribute) ? requestedAttribute : undefined,
      brandId: searchParams.get("brand") || "",
      filters,
      page: positiveInteger(searchParams.get("page"), 1),
      limit: 50,
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo explorar el catalogo de vehiculos.");
  }
}
