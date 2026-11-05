import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getItemsUnificadosListado } from "@/lib/repos/items-unificados";

const MAX_SELECTION = 500;

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const params = request.nextUrl.searchParams;
    const result = await getItemsUnificadosListado(1, MAX_SELECTION, {
      search: params.get("search") || undefined,
      searchSpecific: params.get("searchSpecific") || undefined,
      categoria: params.get("categoria") || undefined,
      subcategoria: params.get("subcategoria") || undefined,
      marca: params.get("marca") || undefined,
      proveedor: params.get("proveedor") || undefined,
    });

    return NextResponse.json({
      data: result.data,
      totalCount: result.totalCount,
      truncated: result.totalCount > MAX_SELECTION,
      maxSelection: MAX_SELECTION,
    });
  } catch (error) {
    return jsonError(error, "No se pudo obtener la seleccion de items.");
  }
}
