import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError, AppError } from "@/lib/api-errors";
import { getPreciosProveedoresParaExportar, getProductosParaExportar } from "@/lib/repos/productos";
import { getKitsParaExportar } from "@/lib/repos/kits";
import { getPiezasParaExportar } from "@/lib/repos/piezas";

export const dynamic = "force-dynamic";

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

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: Record<string, unknown>[], emptyHeaders: string[]) {
  const worksheet = rows.length > 0
    ? XLSX.utils.json_to_sheet(rows)
    : XLSX.utils.aoa_to_sheet([emptyHeaders]);
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const address = XLSX.utils.encode_cell({ r: 0, c: column });
    if (worksheet[address]) worksheet[address].s = headerStyle;
  }

  worksheet["!rows"] = [{ hpt: 30 }];
  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
  worksheet["!cols"] = Array.from({ length: range.e.c - range.s.c + 1 }, (_, column) => {
    const address = XLSX.utils.encode_cell({ r: 0, c: range.s.c + column });
    const title = String(worksheet[address]?.v ?? "");
    return { wch: Math.min(Math.max(title.length + 3, 14), 30) };
  });
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
}

const ITEM_COLUMNS_EXCLUDED_FROM_CATALOG_EXPORT = new Set([
  "Proveedor",
  "Codigo Proveedor",
  "Precio Lista Proveedor",
  "Proveedores y Precios Lista",
  "Usa Serie",
  "Numeros de Serie Disponibles",
]);

function getItemRowsForCatalogExport(rows: Record<string, unknown>[]) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).filter(([column]) => !ITEM_COLUMNS_EXCLUDED_FROM_CATALOG_EXPORT.has(column))
  ));
}

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const { searchParams } = new URL(request.url);
    const includeItems = searchParams.get("items") !== "false";
    const includeKits = searchParams.get("kits") !== "false";

    if (!includeItems && !includeKits) {
      throw new AppError("Elegi items, kits o ambos para exportar.", 400);
    }

    const [items, preciosProveedores, piezas, kitData] = await Promise.all([
      includeItems ? getProductosParaExportar() : Promise.resolve([]),
      includeItems ? getPreciosProveedoresParaExportar() : Promise.resolve([]),
      includeItems ? getPiezasParaExportar() : Promise.resolve([]),
      includeKits ? getKitsParaExportar() : Promise.resolve({ kits: [], componentes: [] }),
    ]);

    const workbook = XLSX.utils.book_new();
    if (includeItems) {
      appendSheet(workbook, "Items", getItemRowsForCatalogExport(items), ["Codigo Unico", "Descripcion"]);
      appendSheet(workbook, "Items asociados", piezas, ["Codigo Item Asociado", "Descripcion", "Categoria", "Subcategoria", "Medida", "Codigos Originales", "Codigos Equivalentes", "Codigos Sustitutos"]);
      appendSheet(workbook, "Precios proveedores", preciosProveedores, ["Codigo Item", "Proveedor", "Codigo Proveedor", "Precio Lista Proveedor"]);
    }
    if (includeKits) {
      appendSheet(workbook, "Kits", kitData.kits, ["Codigo Kit", "Nombre Kit", "Descripcion", "Categoria", "Subcategoria", "Activo"]);
      appendSheet(workbook, "Componentes kits", kitData.componentes, ["Codigo Kit", "Nombre Kit", "Codigo Item", "Cantidad"]);
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="catalogo_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo exportar el catalogo");
  }
}
