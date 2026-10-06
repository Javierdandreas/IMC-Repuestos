import { NextRequest, NextResponse } from "next/server";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { withTransaction } from "@/lib/db-utils";
import {
  asignarCriterioCostoMasivo,
  getResumenCostosMasivos,
  normalizarFiltrosCostoMasivo,
  repararPreciosMasivos,
  validarCriterioCostoMasivo,
} from "@/lib/repos/costos-masivos";

export const maxDuration = 300;

function filtrosDesdeParametros(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  return normalizarFiltrosCostoMasivo({
    idMarca: Number(params.get("marca")),
    idCategoria: Number(params.get("categoria")),
    idSubcategoria: Number(params.get("subcategoria")),
    idProveedor: Number(params.get("proveedor")),
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    return NextResponse.json(await getResumenCostosMasivos(filtrosDesdeParametros(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error, "No se pudo obtener el resumen de costos.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json().catch(() => ({}));
    const filters = normalizarFiltrosCostoMasivo(body?.filters);
    const action = body?.action;
    const result = await withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '280s'");
      if (action === "REPARAR_PRECIOS") return repararPreciosMasivos(client, filters);
      if (action === "ASIGNAR_CRITERIO") {
        return asignarCriterioCostoMasivo(client, filters, validarCriterioCostoMasivo(body?.criterio));
      }
      throw new Error("Accion invalida.");
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron actualizar los costos y precios.");
  }
}
