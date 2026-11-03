import { NextRequest, NextResponse } from "next/server";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { getCostosModificadosImportacionExportable } from "@/lib/repos/proveedor-importaciones";

function csvValue(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function filePart(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/(^-|-$)/g, "").toUpperCase() || "PROVEEDOR";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiReadSession(request);
    const { id } = await params;
    const detail = await getCostosModificadosImportacionExportable(Number(id));
    const rows = [
      ["CODIGO INTERNO", "CODIGO PROVEEDOR", "PROVEEDOR", "COSTO BASE"],
      ...detail.items.map((item) => [
        item.codigo_item,
        item.codigo_proveedor,
        detail.proveedor,
        item.costo_base === null ? "" : item.costo_base.toFixed(2),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvValue).join(",")).join("\r\n")}\r\n`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="COSTO-MODIFICADO-${filePart(detail.proveedor)}.csv"`,
      },
    });
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron exportar los costos modificados.");
  }
}
