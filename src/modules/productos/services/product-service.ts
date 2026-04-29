import { pool } from "@/utils/database";
import { getProductMeta } from "../repos/productos-meta";
import { getProductosParaExportar } from "../repos/productos";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export class ProductService {
  /**
   * Obtiene metadatos de productos (categorÃas, marcas, tipos, etc.)
   */
  static async getMetadata() {
    const [meta, tipoTable] = await Promise.all([
      getProductMeta(),
      pool.query("SELECT to_regclass('public.tipo_producto') AS table_name"),
    ]);

    let tipos = { rows: [] as { id: number; descripcion: string }[] };
    if (tipoTable.rows[0]?.table_name) {
      tipos = await pool.query("SELECT id, descripcion FROM tipo_producto ORDER BY descripcion");
    }

    return {
      ...meta,
      tipos: tipos.rows,
    };
  }

  /**
   * Genera datos para exportaciÃ³n en formato CSV o Excel
   */
  static async exportProducts(filters: any, format: string, columns?: string) {
    const dataFull = await getProductosParaExportar(filters);
    
    let data = dataFull;
    if (columns) {
      const selectedColumns = columns.split(",");
      data = dataFull.map(row => {
        const filtered: any = {};
        selectedColumns.forEach(col => {
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
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      return {
        content: buffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `productos_export_${new Date().toISOString().split('T')[0]}.xlsx`
      };
    }

    // Default: CSV
    const csv = Papa.unparse(data, {
      header: true,
      skipEmptyLines: true,
    });
    const BOM = "\uFEFF";
    const csvWithBOM = BOM + csv;

    return {
      content: csvWithBOM,
      contentType: "text/csv; charset=utf-8",
      filename: `productos_export_${new Date().toISOString().split('T')[0]}.csv`
    };
  }
}
