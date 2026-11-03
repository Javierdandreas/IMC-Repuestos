import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getCostosBaseProveedorParaExportar } from "@/lib/repos/productos";

export const dynamic = "force-dynamic";

function slugArchivo(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase() || "PROVEEDOR";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiReadSession(request);
    const { id } = await params;
    const idProveedor = Number(id);
    if (!Number.isInteger(idProveedor) || idProveedor <= 0) {
      throw new AppError("Proveedor invalido.", 400);
    }

    const data = await getCostosBaseProveedorParaExportar(idProveedor);
    if (!data.length) throw new AppError("El proveedor no tiene items asociados para exportar.", 404);

    const proveedor = data[0].proveedor;
    const rows = data.map((item) => ({
      "Codigo interno": item.codigo_interno,
      "Codigo de proveedor": item.codigo_proveedor,
      Proveedor: item.proveedor,
      "Costo base": item.costo_base,
    }));
    const headers = ["Codigo interno", "Codigo de proveedor", "Proveedor", "Costo base"];
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: column })];
      if (cell) {
        cell.s = {
          fill: { fgColor: { rgb: "1D4ED8" } },
          font: { bold: true, color: { rgb: "FFFFFF" } },
          alignment: { vertical: "center", horizontal: "center" },
        };
      }
    }
    for (let row = 1; row <= range.e.r; row += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: 3 })];
      if (cell) cell.z = '"$" #,##0.00';
    }
    worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    worksheet["!cols"] = [{ wch: 22 }, { wch: 24 }, { wch: 36 }, { wch: 18 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Costos base");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="COSTOS-BASE-${slugArchivo(proveedor)}-${date}.xlsx"`,
      },
    });
  } catch (error) {
    return jsonError(error, "No se pudieron exportar los costos del proveedor.");
  }
}
