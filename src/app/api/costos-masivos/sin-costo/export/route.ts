import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import {
  getItemsSinCostoMasivo,
  normalizarFiltrosCostoMasivo,
} from "@/lib/repos/costos-masivos";

function positiveInteger(value: string | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const params = new URL(request.url).searchParams;
    const result = await getItemsSinCostoMasivo(normalizarFiltrosCostoMasivo({
      idMarca: positiveInteger(params.get("marca")),
      idCategoria: positiveInteger(params.get("categoria")),
      idSubcategoria: positiveInteger(params.get("subcategoria")),
      idProveedor: positiveInteger(params.get("proveedor")),
    }), 1, 100000);
    const rows = result.data.map((item) => ({
      Codigo: item.codigo,
      Descripcion: item.descripcion,
      Marca: item.marca ?? "",
      Categoria: item.categoria,
      Subcategoria: item.subcategoria,
      "Criterio de costo": item.criterioCosto,
      "Proveedores con costo valido": item.proveedoresConCosto,
      "Proveedores validos": item.proveedoresValidos,
      Motivo: item.motivo,
    }));
    const headers = ["Codigo", "Descripcion", "Marca", "Categoria", "Subcategoria", "Criterio de costo", "Proveedores con costo valido", "Proveedores validos", "Motivo"];
    const worksheet = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([headers]);
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: column })];
      if (cell) cell.s = { fill: { fgColor: { rgb: "1D4ED8" } }, font: { bold: true, color: { rgb: "FFFFFF" } } };
    }
    worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    worksheet["!cols"] = [{ wch: 18 }, { wch: 48 }, { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 22 }, { wch: 17 }, { wch: 42 }, { wch: 62 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sin costo asignable");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="items_sin_costo_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    return jsonError(error, "No se pudieron exportar los items sin costo.");
  }
}
