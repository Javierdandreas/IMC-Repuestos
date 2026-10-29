import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { AppError, jsonError } from "@/lib/api-errors";
import { getPreciosModificadosProveedor, registrarExportacionCambiosCosto } from "@/lib/repos/proveedor-importaciones";

function positiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function dateFilter(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function origin(value: string | null) {
  return ["IMPORTACION", "CARGA_MANUAL_PROVEEDOR", "CRITERIO_MASIVO", "REGLAS_PROVEEDOR", "DESCUENTOS_PROVEEDOR", "EDICION_ITEM"].includes(value ?? "")
    ? value as "IMPORTACION" | "CARGA_MANUAL_PROVEEDOR" | "CRITERIO_MASIVO" | "REGLAS_PROVEEDOR" | "DESCUENTOS_PROVEEDOR" | "EDICION_ITEM"
    : undefined;
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiWriteSession(request);
    const { searchParams } = new URL(request.url);
    const filters = {
      idProveedor: positiveInteger(searchParams.get("proveedor")),
      idImportacion: positiveInteger(searchParams.get("importacion")),
      estado: "APROBADOS" as const,
      codigo: searchParams.get("codigo") || undefined,
      fechaDesde: dateFilter(searchParams.get("fecha_desde")),
      fechaHasta: dateFilter(searchParams.get("fecha_hasta")),
      origen: origin(searchParams.get("origen")),
      limit: 100000,
    };
    const result = await getPreciosModificadosProveedor(filters);
    if (!result.data.length) throw new AppError("No hay cambios aprobados para exportar.", 400);
    const headers = ["Fecha", "Proveedor", "CODIGO", "Codigo proveedor", "Costo anterior", "PRECIO COMPRA C/IVA", "Diferencia"];
    const content = [
      headers,
      ...result.data.map((item) => [
        new Date(item.fecha_importacion).toLocaleString("es-AR"),
        item.proveedor,
        item.codigo_item ?? "",
        item.codigo_proveedor ?? "",
        item.costo_anterior ?? "",
        item.costo_nuevo,
        item.diferencia ?? "",
      ]),
    ].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const exported = await registrarExportacionCambiosCosto(result.data.map((item) => Number(item.id)), session.usuarioId, filters);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(`\uFEFF${content}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="costos_modificados_${date}.csv"`,
        "X-Costos-Exportados": String(exported.exportedCount),
      },
    });
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron exportar los costos modificados.");
  }
}
