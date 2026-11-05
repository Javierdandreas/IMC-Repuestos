import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { CATEGORIA_RAIZ_ACCESORIOS_VEHICULOS, obtenerCategoriaMercadoLibre } from "@/lib/mercadolibre-categorias";
import { requireApiReadSession } from "@/lib/api-auth";

export const revalidate = 43_200;

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId") || CATEGORIA_RAIZ_ACCESORIOS_VEHICULOS;
    return NextResponse.json(await obtenerCategoriaMercadoLibre(parentId));
  } catch (error) {
    return jsonError(error, "No se pudieron obtener las categorias de Mercado Libre.");
  }
}
