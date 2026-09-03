import { NextRequest, NextResponse } from "next/server";
import { getProductosParaExportar } from "@/lib/repos/productos";
import Papa from "papaparse";
import * as XLSX from "xlsx-js-style";

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

    const columnsParam = searchParams.get("columns");
    const selectedColumns = columnsParam?.split(",") ?? [];
    const supplierColumns = new Set(["Proveedor", "Codigo Proveedor", "Precio Lista Proveedor"]);
    const dataFull = await getProductosParaExportar(filters, {
      detalleProveedor: selectedColumns.some((column) => supplierColumns.has(column)),
    });
    
    // Filtrar columnas si se solicitan específicamente
    let data = dataFull;
    
    if (columnsParam) {
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
      worksheet["!cols"] = Array.from(
        { length: range.e.c - range.s.c + 1 },
        (_, column) => {
          const address = XLSX.utils.encode_cell({ r: 0, c: range.s.c + column });
          const title = String(worksheet[address]?.v ?? "");
          return { wch: Math.min(Math.max(title.length + 3, 14), 28) };
        }
      );
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
      
      // Generar buffer
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="items_export_${new Date().toISOString().split('T')[0]}.xlsx"`,
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
        "Content-Disposition": `attachment; filename="items_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("❌ Error en exportación:", error);
    return NextResponse.json(
      { message: "Error al exportar items", error: error.message },
      { status: 500 }
    );
  }
}
