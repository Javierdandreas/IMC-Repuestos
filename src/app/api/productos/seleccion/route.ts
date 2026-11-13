import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getItemsUnificadosListado } from "@/lib/repos/items-unificados";
import { puedeVerProductosInactivos } from "@/lib/permissions";
import { MAX_ITEMS_BUSQUEDA_MASIVA, obtenerItemsDeBusquedaMasiva } from "@/lib/seleccion-items";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiReadSession(request);
    const params = request.nextUrl.searchParams;
    const requestedStatus = params.get("estado");
    const estado: "ACTIVOS" | "INACTIVOS" | "TODOS" = puedeVerProductosInactivos(session.rol, session.permisos)
      && (requestedStatus === "INACTIVOS" || requestedStatus === "TODOS")
      ? requestedStatus
      : "ACTIVOS";
    const filters = {
      search: params.get("search") || undefined,
      searchSpecific: params.get("searchSpecific") || undefined,
      categoria: params.get("categoria") || undefined,
      subcategoria: params.get("subcategoria") || undefined,
      marca: params.get("marca") || undefined,
      proveedor: params.get("proveedor") || undefined,
      estado,
      margenes: (params.get("margenes") || undefined) as "COMPLETOS" | "FALTA_ALGUNO" | "FALTA_MOSTRADOR" | "FALTA_MECANICO" | "FALTA_MERCADO_LIBRE" | undefined,
      criterioCosto: (params.get("criterioCosto") || undefined) as "PROVEEDOR_UNICO" | "MANUAL" | "MENOR_PRECIO" | "PROMEDIO_PRECIO" | "MAYOR_PRECIO" | undefined,
      mercadoLibre: (params.get("mercadoLibre") || undefined) as "PUBLICADOS" | "SIN_PUBLICAR" | undefined,
    };

    if (params.get("modo") === "ITEMS_MASIVO") {
      const result = await obtenerItemsDeBusquedaMasiva(filters);
      return NextResponse.json({
        itemCount: result.itemCount,
        totalCount: result.totalCount,
        truncated: result.truncated,
        maxSelection: MAX_ITEMS_BUSQUEDA_MASIVA,
      });
    }

    const result = await getItemsUnificadosListado(1, 500, filters);

    return NextResponse.json({
      data: result.data,
      totalCount: result.totalCount,
      truncated: result.totalCount > 500,
      maxSelection: 500,
    });
  } catch (error) {
    return jsonError(error, "No se pudo obtener la seleccion de items.");
  }
}
