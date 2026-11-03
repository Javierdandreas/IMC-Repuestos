import { NextRequest, NextResponse } from "next/server";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getExportacionCostoParaDescarga } from "@/lib/repos/proveedor-importaciones";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function filenameForProviders(providers: string[]) {
  const uniqueProviders = [...new Set(providers.map((item) => item.trim()).filter(Boolean))];
  const provider = uniqueProviders.length === 1 ? uniqueProviders[0] : "VARIOS";
  const safeProvider = provider
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .toUpperCase();
  return `COSTO-MODIFICADO-${safeProvider || "SIN-PROVEEDOR"}.csv`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiReadSession(request);
    const { id } = await params;
    const exportId = Number(id);
    if (!Number.isInteger(exportId) || exportId <= 0) throw new AppError("Exportacion invalida.", 400);

    const rows = await getExportacionCostoParaDescarga(exportId);
    const headers = ["Fecha", "Proveedor", "CODIGO", "Codigo proveedor", "Costo anterior", "PRECIO COMPRA C/IVA", "Diferencia"];
    const content = [
      headers,
      ...rows.map((item) => [
        item.fecha_importacion ? new Date(item.fecha_importacion).toLocaleString("es-AR") : "",
        item.proveedor,
        item.codigo_item ?? "",
        item.codigo_proveedor ?? "",
        item.costo_anterior ?? "",
        item.costo_nuevo,
        item.diferencia ?? "",
      ]),
    ].map((row) => row.map(csvCell).join(";")).join("\r\n");

    return new NextResponse(`\uFEFF${content}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameForProviders(rows.map((item) => item.proveedor))}"`,
      },
    });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo descargar nuevamente la exportacion.");
  }
}
