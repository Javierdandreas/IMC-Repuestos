import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { resolverCambiosCostoReferencia, resolverTodosLosCambiosCostoFiltrados, type FiltroOrigenCambioCosto } from "@/lib/repos/proveedor-importaciones";

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function dateFilter(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function origin(value: unknown): FiltroOrigenCambioCosto | undefined {
  return ["IMPORTACION", "CARGA_MANUAL_PROVEEDOR", "CRITERIO_MASIVO", "REGLAS_PROVEEDOR", "DESCUENTOS_PROVEEDOR", "EDICION_ITEM"].includes(value as string)
    ? value as FiltroOrigenCambioCosto
    : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiWriteSession(request);
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : [];
    const accion = body?.accion === "APROBAR" || body?.accion === "RECHAZAR" ? body.accion : null;
    if (!accion) {
      return NextResponse.json({ message: "Accion invalida." }, { status: 400 });
    }

    const result = body?.todosFiltrados === true
      ? await resolverTodosLosCambiosCostoFiltrados({
          idProveedor: positiveInteger(body?.filters?.proveedor),
          codigo: typeof body?.filters?.codigo === "string" ? body.filters.codigo : undefined,
          fechaDesde: dateFilter(body?.filters?.fechaDesde),
          fechaHasta: dateFilter(body?.filters?.fechaHasta),
          origen: origin(body?.filters?.origen),
        }, accion, session.usuarioId)
      : await resolverCambiosCostoReferencia(ids, accion, session.usuarioId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo resolver el cambio de costo.");
  }
}
