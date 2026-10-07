import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx-js-style";

import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { getMovimientosStockParaExportar } from "@/lib/repos/movimientos-stock";

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

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") === "csv" ? "csv" : "excel";
    const rows = await getMovimientosStockParaExportar({
      search: searchParams.get("search") || undefined,
      id_ubicacion: searchParams.get("id_ubicacion") || undefined,
      tipo: (searchParams.get("tipo") || "") as "INGRESO" | "EGRESO" | "AJUSTE" | "TRANSFERENCIA" | "",
      desde: searchParams.get("desde") || undefined,
      hasta: searchParams.get("hasta") || undefined,
    });
    const date = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      return new NextResponse(`\uFEFF${Papa.unparse(rows)}`, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="movimientos_stock_${date}.csv"` },
      });
    }
    const worksheet = XLSX.utils.json_to_sheet(rows);
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
      return { wch: Math.min(Math.max(title.length + 3, 14), 32) };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");
    return new NextResponse(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="movimientos_stock_${date}.xlsx"` },
    });
  } catch (error) {
    return jsonError(error, "No se pudieron exportar los movimientos de stock");
  }
}
