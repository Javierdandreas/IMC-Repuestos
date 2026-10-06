import { NextRequest, NextResponse } from "next/server";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import {
  getItemsSinCostoMasivo,
  normalizarFiltrosCostoMasivo,
} from "@/lib/repos/costos-masivos";

function positiveInteger(value: string | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function filtersFromRequest(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  return normalizarFiltrosCostoMasivo({
    idMarca: positiveInteger(params.get("marca")),
    idCategoria: positiveInteger(params.get("categoria")),
    idSubcategoria: positiveInteger(params.get("subcategoria")),
    idProveedor: positiveInteger(params.get("proveedor")),
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const params = new URL(request.url).searchParams;
    const result = await getItemsSinCostoMasivo(
      filtersFromRequest(request),
      positiveInteger(params.get("page")) ?? 1,
      positiveInteger(params.get("limit")) ?? 50,
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron obtener los items sin costo.");
  }
}
