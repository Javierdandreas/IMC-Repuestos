import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { getPreciosModificadosProveedor } from "@/lib/repos/proveedor-importaciones";

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

const headerStyle = {
  fill: { fgColor: { rgb: "1D4ED8" } },
  font: { bold: true, color: { rgb: "FFFFFF" } },
  alignment: { vertical: "center", horizontal: "center", wrapText: true },
};

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const { searchParams } = new URL(request.url);
    const result = await getPreciosModificadosProveedor({
      idProveedor: positiveInteger(searchParams.get("proveedor")),
      idImportacion: positiveInteger(searchParams.get("importacion")),
      estado: "APROBADOS",
      codigo: searchParams.get("codigo") || undefined,
      fechaDesde: dateFilter(searchParams.get("fecha_desde")),
      fechaHasta: dateFilter(searchParams.get("fecha_hasta")),
      origen: origin(searchParams.get("origen")),
      limit: 100000,
    });
    const rows = result.data.map((item) => ({
      Fecha: new Date(item.fecha_importacion).toLocaleString("es-AR"),
      Proveedor: item.proveedor,
      Archivo: item.archivo,
      Origen: item.origen === "IMPORTACION"
        ? "Importacion de lista"
        : item.origen === "CARGA_MANUAL_PROVEEDOR"
          ? "Carga manual de precios"
        : item.origen === "CRITERIO_MASIVO"
          ? "Cambio masivo de criterio"
          : item.origen === "REGLAS_PROVEEDOR"
            ? "Capas de costo"
            : item.origen === "DESCUENTOS_PROVEEDOR"
              ? "Descuentos de proveedor"
              : "Edicion de item",
      "Codigo item": item.codigo_item ?? "",
      Descripcion: item.descripcion_item ?? "",
      "Codigo proveedor": item.codigo_proveedor,
      Tipo: item.tipo_cambio === "COSTO_NUEVO" ? "Costo nuevo" : "Costo modificado",
      "Costo anterior": item.costo_anterior,
      "Costo nuevo": item.costo_nuevo,
      Diferencia: item.diferencia,
      "Diferencia %": item.diferencia_porcentaje === null ? null : item.diferencia_porcentaje / 100,
      Estado: item.estado_aprobacion === "APROBADO_MANUAL" ? "Aprobado manualmente" : "Aprobado automaticamente",
    }));
    const headers = ["Fecha", "Proveedor", "Archivo", "Origen", "Codigo item", "Descripcion", "Codigo proveedor", "Tipo", "Costo anterior", "Costo nuevo", "Diferencia", "Diferencia %", "Estado"];
    const worksheet = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([headers]);
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: 0, c: column });
      if (worksheet[address]) worksheet[address].s = headerStyle;
    }
    for (let row = 1; row <= range.e.r; row += 1) {
      [8, 9, 10].forEach((column) => {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (cell) cell.z = '"$" #,##0.00';
      });
      const percentage = worksheet[XLSX.utils.encode_cell({ r: row, c: 11 })];
      if (percentage) percentage.z = "0.00%";
    }
    worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    worksheet["!cols"] = [
      { wch: 19 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 18 }, { wch: 44 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 15 }, { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Costos modificados");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="costos_modificados_${date}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron exportar los costos modificados.");
  }
}
