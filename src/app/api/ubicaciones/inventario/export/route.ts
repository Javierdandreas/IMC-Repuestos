import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { requireApiSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { getInventarioUbicacionesParaExportar } from "@/lib/repos/ubicaciones-inventario";
import {
  parseInventarioExportColumns,
  pickInventarioExportColumns,
} from "@/lib/ubicaciones-inventario-export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requireApiSession(request);

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";

    const dataFull = await getInventarioUbicacionesParaExportar({
      search: searchParams.get("search") || undefined,
      id_ubicacion: searchParams.get("id_ubicacion") || undefined,
      estado: searchParams.get("estado") || undefined,
      tipo: (searchParams.get("tipo") || "") as "SERIE" | "STOCK" | "",
      canal: (searchParams.get("canal") || "") as "ONLINE" | "MOSTRADOR" | "NO_VENDIBLE" | "",
    });
    const columns = parseInventarioExportColumns(searchParams.get("columns"));
    const data = pickInventarioExportColumns(dataFull, columns);

    const date = new Date().toISOString().split("T")[0];

    if (format === "excel") {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="inventario_ubicaciones_${date}.xlsx"`,
        },
      });
    }

    const csv = Papa.unparse(data, {
      header: true,
      skipEmptyLines: true,
    });

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventario_ubicaciones_${date}.csv"`,
      },
    });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo exportar el inventario por ubicacion");
  }
}
