import { getKitsListado, createKit, getKitsParaExportar } from "../repos/kits";
import { AppError } from "@/lib/api-errors";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export class KitService {
  /**
   * Obtiene la lista paginada de kits
   */
  static async list(page: number, limit: number, search?: string) {
    return await getKitsListado(page, limit, search);
  }

  /**
   * Crea un nuevo kit con sus componentes
   */
  static async create(payload: any) {
    if (!payload.nombre || !payload.codigo_kit || !payload.componentes || payload.componentes.length === 0) {
      throw new AppError("Nombre, cÃ³digo y componentes son requeridos", 400);
    }

    return await createKit(payload);
  }

  /**
   * Genera datos para exportaciÃ³n en formato CSV o Excel
   */
  static async exportKits(format: string, columns: string[] = []) {
    let data = await getKitsParaExportar();

    // Filtro de columnas si se especifican
    if (columns.length > 0) {
      data = data.map((item: any) => {
        const filtered: any = {};
        columns.forEach(col => {
          if (item.hasOwnProperty(col)) {
            filtered[col] = item[col];
          }
        });
        return filtered;
      });
    }

    if (format === "excel") {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Kits");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      return {
        content: buffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `kits_export_${new Date().toISOString().split('T')[0]}.xlsx`
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
      filename: `kits_export_${new Date().toISOString().split('T')[0]}.csv`
    };
  }
}
