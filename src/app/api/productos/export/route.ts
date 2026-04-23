import { NextRequest, NextResponse } from "next/server";
import { getProductosParaExportar } from "@/lib/repos/productos";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";
    
    const filters = {
      search: searchParams.get("search") || undefined,
      searchSpecific: searchParams.get("searchSpecific") || undefined,
      categoria: searchParams.get("categoria") || undefined,
      subcategoria: searchParams.get("subcategoria") || undefined,
      marca: searchParams.get("marca") || undefined,
      proveedor: searchParams.get("proveedor") || undefined,
    };

    const dataFull = await getProductosParaExportar(filters);
    
    // Filtrar columnas si se solicitan específicamente
    const columnsParam = searchParams.get("columns");
    let data = dataFull;
    
    if (columnsParam) {
      const selectedColumns = columnsParam.split(",");
      data = dataFull.map(row => {
        const filtered: any = {};
        selectedColumns.forEach(col => {
          // Buscamos coincidencia exacta o por el nombre formateado que viene del repo
          if (row[col] !== undefined) {
            filtered[col] = row[col];
          }
        });
        return filtered;
      });
    }

    if (format === "excel") {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
      
      // Generar buffer
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="productos_export_${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    }
    
    // Default: CSV
    const csv = Papa.unparse(data, {
      header: true,
      skipEmptyLines: true,
    });

    const BOM = "\uFEFF";
    const csvWithBOM = BOM + csv;

    return new NextResponse(csvWithBOM, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="productos_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("❌ Error en exportación:", error);
    return NextResponse.json(
      { message: "Error al exportar productos", error: error.message },
      { status: 500 }
    );
  }
}
