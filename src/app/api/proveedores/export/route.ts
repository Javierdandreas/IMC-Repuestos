import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx-js-style";

import { requireApiReadSession } from "@/lib/api-auth";
import { getProveedoresParaExportar } from "@/lib/repos/catalogos";
import { jsonError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const columnasDisponibles = [
  "Nombre", "CUIT / DNI", "Condición IVA", "Comprobante predeterminado",
  "Contacto principal", "Telefono", "Email", "Domicilio fiscal",
  "Provincia", "Localidad", "Codigo postal", "Estado", "Observaciones",
] as const;

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const params = new URL(request.url).searchParams;
    const format = params.get("format") || "excel";
    const requestedColumns = (params.get("columns") || "").split(",").map((column) => column.trim()).filter(Boolean);
    const selectedColumns = requestedColumns.length
      ? columnasDisponibles.filter((column) => requestedColumns.includes(column))
      : [...columnasDisponibles];
    if (!selectedColumns.length) {
      return NextResponse.json({ message: "Selecciona al menos una columna para exportar." }, { status: 400 });
    }
    const data = (await getProveedoresParaExportar()).map((row) => Object.fromEntries(selectedColumns.map((column) => [column, row[column] ?? ""])));
    const date = new Date().toISOString().split("T")[0];

    if (format === "excel") {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      const headerStyle = {
        fill: { fgColor: { rgb: "1D4ED8" } },
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "1E3A8A" } },
          bottom: { style: "thin", color: { rgb: "1E3A8A" } },
          left: { style: "thin", color: { rgb: "1E3A8A" } },
          right: { style: "thin", color: { rgb: "1E3A8A" } },
        },
      };

      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const address = XLSX.utils.encode_cell({ r: 0, c: column });
        if (worksheet[address]) worksheet[address].s = headerStyle;
      }

      worksheet["!rows"] = [{ hpt: 30 }];
      worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
      worksheet["!cols"] = selectedColumns.map((column) => ({ wch: column === "Nombre" ? 42 : column === "Observaciones" || column === "Domicilio fiscal" ? 44 : 22 }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Proveedores");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="proveedores_${date}.xlsx"`,
        },
      });
    }

    const csv = "\uFEFF" + Papa.unparse(data, { header: true, skipEmptyLines: true });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="proveedores_${date}.csv"`,
      },
    });
  } catch (error) {
    return jsonError(error, "No se pudieron exportar los proveedores");
  }
}
