import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { getDetalleImportacionExportable } from "@/lib/repos/proveedor-importaciones";

const headerStyle = {
  fill: { fgColor: { rgb: "1D4ED8" } },
  font: { bold: true, color: { rgb: "FFFFFF" } },
  alignment: { vertical: "center", horizontal: "center", wrapText: true },
};

type ExportRow = Record<string, string | number | null>;

function buildWorksheet(rows: ExportRow[], headers: string[], moneyHeaders: string[] = [], percentageHeaders: string[] = []) {
  const worksheet = rows.length > 0
    ? XLSX.utils.json_to_sheet(rows, { header: headers })
    : XLSX.utils.aoa_to_sheet([headers]);
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    if (cell) cell.s = headerStyle;
  }

  moneyHeaders.forEach((header) => {
    const column = headers.indexOf(header);
    if (column < 0) return;
    for (let row = 1; row <= range.e.r; row += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) cell.z = '"$" #,##0.00';
    }
  });
  percentageHeaders.forEach((header) => {
    const column = headers.indexOf(header);
    if (column < 0) return;
    for (let row = 1; row <= range.e.r; row += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) cell.z = "0.00%";
    }
  });

  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  worksheet["!cols"] = headers.map((header) => ({ wch: Math.min(Math.max(header.length + 3, 14), 34) }));
  return worksheet;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiReadSession(_request);
    const { id } = await params;
    const detail = await getDetalleImportacionExportable(Number(id));
    const updated = detail.items.filter((item) => item.estado === "ACTUALIZADO");
    const unlinked = detail.items.filter((item) => item.estado === "NO_ENCONTRADO");
    const invalid = detail.items.filter((item) => item.estado === "INVALIDO");
    const duplicates = detail.items.filter((item) => item.estado === "DUPLICADO");

    const itemHeaders = ["Fila", "Codigo proveedor", "Codigo IMC", "Descripcion", "Precio lista", "Stock", "Estado", "Detalle"];
    const itemRows = (items: typeof detail.items): ExportRow[] => items.map((item) => ({
      Fila: item.fila ?? null,
      "Codigo proveedor": item.codigo_proveedor,
      "Codigo IMC": item.producto_codigo ?? "",
      Descripcion: item.producto_descripcion ?? "",
      "Precio lista": item.precio_lista ?? null,
      Stock: item.stock_original ?? "",
      Estado: (item.estado ?? "").replace(/_/g, " "),
      Detalle: item.mensaje ?? "",
    }));

    const summaryHeaders = ["Concepto", "Valor"];
    const summaryRows: ExportRow[] = [
      { Concepto: "Importacion", Valor: detail.importacion.id },
      { Concepto: "Proveedor", Valor: detail.importacion.proveedor },
      { Concepto: "Archivo", Valor: detail.importacion.nombre_archivo },
      { Concepto: "Fecha", Valor: new Date(detail.importacion.created_at).toLocaleString("es-AR") },
      { Concepto: "Filas importadas", Valor: detail.items.length },
      { Concepto: "Actualizados", Valor: updated.length },
      { Concepto: "Aprobacion pendiente", Valor: detail.cambiosPendientes.length },
      { Concepto: "Sin codigo de proveedor asociado", Valor: unlinked.length },
      { Concepto: "Invalidos", Valor: invalid.length },
      { Concepto: "Duplicados", Valor: duplicates.length },
    ];
    const pendingHeaders = ["Codigo IMC", "Descripcion", "Codigo proveedor", "Costo anterior", "Costo nuevo", "Variacion %"];
    const pendingRows: ExportRow[] = detail.cambiosPendientes.map((item) => ({
      "Codigo IMC": item.codigo_item ?? "",
      Descripcion: item.descripcion_item ?? "",
      "Codigo proveedor": item.codigo_proveedor ?? "",
      "Costo anterior": item.costo_anterior,
      "Costo nuevo": item.costo_nuevo,
      "Variacion %": item.diferencia_porcentaje === null ? null : item.diferencia_porcentaje / 100,
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, buildWorksheet(summaryRows, summaryHeaders), "Resumen");
    XLSX.utils.book_append_sheet(workbook, buildWorksheet(itemRows(updated), itemHeaders, ["Precio lista"]), "Actualizados");
    XLSX.utils.book_append_sheet(workbook, buildWorksheet(pendingRows, pendingHeaders, ["Costo anterior", "Costo nuevo"], ["Variacion %"]), "A aprobar");
    XLSX.utils.book_append_sheet(workbook, buildWorksheet(itemRows(unlinked), itemHeaders, ["Precio lista"]), "Sin asociar");
    XLSX.utils.book_append_sheet(workbook, buildWorksheet(itemRows(invalid), itemHeaders, ["Precio lista"]), "Invalidos");
    XLSX.utils.book_append_sheet(workbook, buildWorksheet(itemRows(duplicates), itemHeaders, ["Precio lista"]), "Duplicados");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="importacion_${detail.importacion.id}_detalle_${date}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo exportar el detalle de la importacion.");
  }
}
